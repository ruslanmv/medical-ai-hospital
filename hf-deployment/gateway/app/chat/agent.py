# gateway/app/chat/agent.py — LangGraph medical agent with HuggingFace LLM
from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List, Optional, TypedDict

from langgraph.graph import StateGraph, END

from ..config import settings
from ..medical_tools.tools import TOOL_REGISTRY, triage_symptoms

log = logging.getLogger("gateway.agent")

# HuggingFace Inference Client (lazy init)
_hf_client = None


def _get_hf_client():
    global _hf_client
    if _hf_client is None:
        from huggingface_hub import InferenceClient
        token = settings.hf_token or None
        _hf_client = InferenceClient(token=token)
    return _hf_client


# ---------------------------------------------------------------------------
# Agent State
# ---------------------------------------------------------------------------

class AgentState(TypedDict):
    user_message: str
    args: Dict[str, Any]
    intent: str
    tool_name: str
    tool_result: Optional[Dict[str, Any]]
    llm_response: str
    final_response: Dict[str, Any]


# ---------------------------------------------------------------------------
# LangGraph Nodes
# ---------------------------------------------------------------------------

MEDICAL_SYSTEM_PROMPT = """You are a medical AI assistant at a hospital portal. You help patients with:
- Symptom triage and initial assessment
- Drug information and interaction checks
- General health questions and guidance

You are professional, empathetic, and always remind patients to consult healthcare professionals.
You have access to medical tools for triage, drug information, and clinical calculations.

Based on the tool results provided, give a clear, helpful response to the patient.
Keep responses concise but informative. Use medical terminology where appropriate but explain in plain language.

IMPORTANT: Always include a disclaimer that this is AI-assisted and not a substitute for professional medical advice."""


def classify_intent(state: AgentState) -> AgentState:
    """Classify user intent to determine which medical tool to use."""
    msg = (state.get("user_message") or "").lower()
    args = state.get("args") or {}

    # If explicit tool args are provided, use triage
    if args.get("symptoms") or args.get("age") or args.get("sex"):
        state["intent"] = "triage"
        state["tool_name"] = "triageSymptoms"
        return state

    # Keyword-based intent classification
    if any(kw in msg for kw in ["symptom", "pain", "ache", "fever", "cough",
                                 "breath", "dizzy", "nausea", "triage",
                                 "emergency", "urgent", "chest"]):
        state["intent"] = "triage"
        state["tool_name"] = "triageSymptoms"
    elif any(kw in msg for kw in ["drug", "medication", "medicine", "pill",
                                   "dose", "dosage", "prescri"]):
        if any(kw in msg for kw in ["interact", "combination", "together", "mix"]):
            state["intent"] = "drug_interaction"
            state["tool_name"] = "getDrugInteractions"
        elif any(kw in msg for kw in ["alternative", "substitute", "replace"]):
            state["intent"] = "drug_alternatives"
            state["tool_name"] = "getDrugAlternatives"
        elif any(kw in msg for kw in ["contraindic", "should not", "avoid"]):
            state["intent"] = "drug_contraindications"
            state["tool_name"] = "getDrugContraindications"
        else:
            state["intent"] = "drug_info"
            state["tool_name"] = "getDrugInfo"
    elif any(kw in msg for kw in ["bmi", "weight", "height", "clinical score",
                                   "calculate", "creatinine"]):
        state["intent"] = "clinical_calc"
        state["tool_name"] = "calcClinicalScores"
    elif any(kw in msg for kw in ["appointment", "schedule", "book", "visit"]):
        state["intent"] = "scheduling"
        state["tool_name"] = "scheduleAppointment"
    elif any(kw in msg for kw in ["patient", "profile", "360", "overview"]):
        state["intent"] = "patient_info"
        state["tool_name"] = "getPatient360"
    else:
        state["intent"] = "general"
        state["tool_name"] = "searchMedicalKB"

    return state


def execute_tool(state: AgentState) -> AgentState:
    """Execute the selected medical tool."""
    tool_name = state.get("tool_name", "triageSymptoms")
    msg = state.get("user_message", "")
    args = state.get("args") or {}

    try:
        tool_fn = TOOL_REGISTRY.get(tool_name)
        if not tool_fn:
            state["tool_result"] = {"error": f"Unknown tool: {tool_name}"}
            return state

        # Build tool arguments based on intent
        if tool_name == "triageSymptoms":
            tool_args = {
                "age": args.get("age", 0),
                "sex": args.get("sex", "unknown"),
                "symptoms": args.get("symptoms", []),
                "duration_text": args.get("duration_text"),
                "query": msg,
            }
            state["tool_result"] = tool_fn(**tool_args)

        elif tool_name == "getDrugInfo":
            # Extract drug name from message
            drug = _extract_drug_name(msg) or args.get("name", msg)
            state["tool_result"] = tool_fn(drug)

        elif tool_name == "getDrugInteractions":
            drugs = args.get("drugs", _extract_drug_names(msg))
            state["tool_result"] = tool_fn(drugs)

        elif tool_name == "getDrugAlternatives":
            drug = _extract_drug_name(msg) or args.get("drug", msg)
            state["tool_result"] = tool_fn(drug)

        elif tool_name == "getDrugContraindications":
            drug = _extract_drug_name(msg) or args.get("drug", msg)
            allergies = args.get("allergies", [])
            state["tool_result"] = tool_fn(drug, allergies)

        elif tool_name == "calcClinicalScores":
            state["tool_result"] = tool_fn(
                age=args.get("age", 45),
                sex=args.get("sex", "male"),
                weight_kg=args.get("weight_kg", 70),
                height_cm=args.get("height_cm", 170),
                serum_creatinine_mg_dl=args.get("serum_creatinine_mg_dl", 1.0),
            )

        elif tool_name == "scheduleAppointment":
            state["tool_result"] = tool_fn(
                patient_id=args.get("patient_id", "PT-0001"),
                datetime_iso=args.get("datetime_iso", ""),
                reason=args.get("reason", msg),
            )

        elif tool_name == "searchMedicalKB":
            state["tool_result"] = tool_fn(query=msg)

        else:
            state["tool_result"] = tool_fn(**args) if args else tool_fn()

    except Exception as e:
        log.exception("Tool execution failed: %s", tool_name)
        state["tool_result"] = {"error": str(e)}

    return state


def generate_response(state: AgentState) -> AgentState:
    """Generate a natural language response using HuggingFace LLM."""
    tool_result = state.get("tool_result", {})
    user_message = state.get("user_message", "")

    # Try to get LLM response
    try:
        client = _get_hf_client()
        prompt = f"""Tool results: {json.dumps(tool_result, default=str)}

Patient's message: {user_message}

Provide a clear, empathetic response based on the tool results. Include specific medical information from the results."""

        response = client.chat_completion(
            model=settings.hf_model_id,
            messages=[
                {"role": "system", "content": MEDICAL_SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            max_tokens=512,
            temperature=0.3,
        )
        llm_text = response.choices[0].message.content
        state["llm_response"] = llm_text

    except Exception as e:
        log.warning("LLM call failed (using tool results directly): %s", e)
        state["llm_response"] = _format_tool_result_fallback(tool_result, state.get("intent", "general"))

    state["final_response"] = {
        "ok": True,
        "tool": state.get("tool_name", ""),
        "result": tool_result,
        "message": state.get("llm_response", ""),
        "intent": state.get("intent", "general"),
    }
    return state


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

KNOWN_DRUGS = ["ibuprofen", "warfarin", "lisinopril", "aspirin", "acetaminophen",
               "losartan", "amlodipine", "metformin", "omeprazole", "penicillin"]


def _extract_drug_name(text: str) -> Optional[str]:
    text_lower = text.lower()
    for drug in KNOWN_DRUGS:
        if drug in text_lower:
            return drug
    return None


def _extract_drug_names(text: str) -> List[str]:
    text_lower = text.lower()
    found = [drug for drug in KNOWN_DRUGS if drug in text_lower]
    return found if found else [text]


def _format_tool_result_fallback(result: Dict[str, Any], intent: str) -> str:
    """Format tool results as readable text when LLM is unavailable."""
    if "error" in result:
        return f"I encountered an issue processing your request: {result['error']}"

    if intent == "triage":
        acuity = result.get("acuity", "routine")
        advice = result.get("advice", "")
        steps = result.get("next_steps", [])
        msg = f"**Triage Assessment: {acuity.upper()}**\n\n{advice}"
        if steps:
            msg += "\n\n**Recommended next steps:**\n" + "\n".join(f"- {s}" for s in steps)
        msg += "\n\n*Disclaimer: This is an AI-assisted assessment. Please consult a healthcare professional.*"
        return msg

    if intent == "drug_info":
        name = result.get("name", "Unknown")
        indications = result.get("indications", [])
        adverse = result.get("common_adverse_effects", result.get("adverse_effects", []))
        msg = f"**Drug Information: {name}**\n"
        if result.get("drug_class"):
            msg += f"\nClass: {result['drug_class']}"
        if indications:
            msg += f"\nIndications: {', '.join(indications)}"
        if adverse:
            msg += f"\nCommon side effects: {', '.join(adverse)}"
        return msg

    if intent == "drug_interaction":
        severity = result.get("severity", "unknown")
        desc = result.get("description", "")
        return f"**Drug Interaction Check**\nSeverity: {severity.upper()}\n{desc}"

    # Generic fallback
    return json.dumps(result, indent=2, default=str)


# ---------------------------------------------------------------------------
# Build LangGraph
# ---------------------------------------------------------------------------

def _build_graph():
    graph = StateGraph(AgentState)

    graph.add_node("classify", classify_intent)
    graph.add_node("execute_tool", execute_tool)
    graph.add_node("generate_response", generate_response)

    graph.set_entry_point("classify")
    graph.add_edge("classify", "execute_tool")
    graph.add_edge("execute_tool", "generate_response")
    graph.add_edge("generate_response", END)

    return graph.compile()


# Compiled graph (singleton)
_agent = None


def get_agent():
    global _agent
    if _agent is None:
        _agent = _build_graph()
    return _agent


async def run_agent(message: str, args: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Run the LangGraph medical agent and return the response."""
    agent = get_agent()

    initial_state: AgentState = {
        "user_message": message or "",
        "args": args or {},
        "intent": "",
        "tool_name": "",
        "tool_result": None,
        "llm_response": "",
        "final_response": {},
    }

    result = await agent.ainvoke(initial_state)
    return result.get("final_response", {"ok": False, "error": "Agent failed"})
