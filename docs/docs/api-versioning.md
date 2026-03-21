---
sidebar_position: 21
---

# API Versioning

Vordr now exposes API version records through the enterprise admin surface.

## Purpose

API version records let operators communicate:
- active versions
- deprecation dates
- sunset dates
- release note links

## Recommended policy

- publish version changes before breaking behaviour ships
- set deprecation dates first
- set sunset dates only when migration guidance exists
- keep release note links stable

## Current scope

The current implementation provides:
- version records in the database
- enterprise API listing endpoint
- frontend visibility in Enterprise admin

It does not yet enforce version negotiation at the HTTP routing layer.
