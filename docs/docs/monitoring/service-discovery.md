# Service Discovery

ArgusMonitor supports lightweight service discovery so users do not need to define every obvious service by hand.

## Current design direction

Discovery should be:

- useful
- bounded
- predictable
- not excessively noisy

## Practical approach

A good baseline discovery flow is:

- scan known monitored hosts only
- use a small curated port list
- create service records for discovered endpoints
- avoid aggressive constant scanning
