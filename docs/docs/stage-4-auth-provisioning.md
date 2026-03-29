---
sidebar_position: 27
---

# Auth and Provisioning Flows

This page covers the live identity and provisioning flows that extend Vordr beyond basic local authentication.

## Covered areas

The current scope includes work across:

- OIDC sign-in flows
- SCIM provisioning endpoints
- SAML sign-in flow foundations
- user auto-linking and auto-provisioning paths

## Why this matters

Identity and provisioning are often the difference between a promising internal tool and something a formal team can realistically pilot.

## Honest status

This is a meaningful step toward production-grade identity support, but it should still be presented honestly.

It is not yet the same thing as claiming perfect protocol coverage or exhaustive compliance in every edge case.

## What to verify in a demo environment

If you plan to show these capabilities publicly, validate:

- sign-in flow starts and callbacks complete cleanly
- workspace membership is assigned as expected
- default-role behaviour is sensible
- provisioning changes are visible and auditable
