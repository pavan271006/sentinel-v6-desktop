# Algorithms: HTTP Desync & Smuggling Detector

## 1. Non-Destructive Timeout Hang Probing
- **Time Complexity**: $O(1)$ probe construction.
- **Payload Design**: Injects unfinished chunk prefix (CL.TE) or short body length (TE.CL) so backend socket hangs without sending secondary payload to another user.

## 2. Single-Packet Multi-Frame Synchronization
- **Time Complexity**: $O(K)$ buffer concatenation.
- **Physical Boundary**: Guarantees assembled frames fit within 1460-byte Ethernet TCP Maximum Segment Size (MSS), dispatching in a single network interface card (NIC) interrupt.
