# AI Copilot

Vordr’s AI copilot is intended to work as an operations assistant, not a generic chatbot.

Its value comes from being grounded in the monitoring context Vordr already has.

## What it can work from

Depending on what is available in the environment, the AI assistant can reason over:

- monitored hosts
- discovered services
- active alerts
- active incidents
- transaction runs and failures
- agent inspection results
- Kubernetes context when cluster data is present

## What that means in practice

The assistant is most useful for tasks such as:

- explaining an alert in operational terms
- summarising current incidents
- identifying likely hotspots or degraded services
- turning a natural-language workflow into a transaction definition
- helping operators inspect the current state without jumping through several pages manually

## Example prompts

- Explain this alert
- Which services are currently unhealthy?
- Summarise the incidents affecting this workspace
- What changed in this cluster?
- Build a transaction for our login flow
- Show me the likely issue on node01

## Grounding and limitations

The copilot is only as good as the context it receives.

That means:

- it should answer from real monitoring data when that data is available
- it should say so clearly when the requested resource is not present in context
- it should not pretend it queried systems that were never supplied to it

## Deployment note

In the current product path, AI provider configuration is handled server-side rather than in the browser. That keeps provider secrets out of the frontend and lets the backend enrich requests with monitoring context.
