---
sidebar_position: 24
---

# API Versioning

Vordr exposes API version metadata so operators and customers can see which versions are active, deprecated, or nearing sunset.

## Why this matters

Version visibility helps teams communicate change without surprising integrators.

Useful version records should make it easy to see:

- active versions
- deprecation dates
- sunset dates
- release-note references

## Current scope

The current implementation provides:

- version records in the database
- enterprise API visibility for those records
- frontend visibility in administrative surfaces

## Honest limit

This is currently a visibility and governance layer.

It does **not** yet mean HTTP routing is enforcing full version negotiation across the platform.

## Practical policy guidance

A sensible approach is:

- publish deprecation dates before breaking changes ship
- publish sunset dates only when migration guidance exists
- keep release-note links stable and obvious
