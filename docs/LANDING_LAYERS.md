# Landing scene layers

Generated from `apps/storefront/src/components/landing/scene/layers.ts` by
`node scripts/gen-landing-layers-doc.mjs`. Do not edit by hand.

**100 layers**: 40 × 2D, 40 × 2.5D, 20 × 3D.
Rendered per tier: **lite 24** · **standard 69** · **full 100**.

## Tiers

| Tier | Layers | Motion | When |
| --- | ---: | --- | --- |
| lite | 24 | none (still poster) | default until the FPS probe passes; reduced motion, Save-Data, 2G/3G, < 4 GB memory or < 4 cores, "Reduce effects" on |
| standard | 69 | scroll parallax, pointer tilt | probe ≥ 40 fps |
| full | 100 | everything | probe ≥ 50 fps on ≥ 8 cores and ≥ 8 GB |

Force a tier with `?layers=lite|standard|full`. In development, `?sceneDebug` shows tier, layer count and FPS.

## 3D rendering

The 20 "3D" layers (phone, stall, scooter and rider, map pins, parcels, cart,
order tag, mid-street boxes) are original low-poly objects built in code with
CSS 3D transforms (`preserve-3d` boxes and tilted planes). They are not WebGL
glTF models yet — no three.js is shipped, which keeps the page well inside the
lite and full download budgets. Moving them to a single WebGL canvas is a
possible later step if the owner wants richer models.

## All layers

| ID | Name | Type | Band | Depth | Parallax | Scroll range | Tier | Interaction | Cost |
| --- | --- | --- | --- | ---: | ---: | --- | --- | --- | --- |
| L001 | Sky gradient | 2d | A Background | -1000 | 0 | 0–1 | lite | none | low |
| L002 | Sun glow | 2d | A Background | -980 | 0.05 | 0–1 | lite | none | low |
| L003 | Horizon light | 2d | A Background | -960 | 0.06 | 0–1 | lite | none | low |
| L004 | Cloud 1 | 2d | A Background | -940 | 0.08 | 0–1 | lite | scroll | low |
| L005 | Cloud 2 | 2d | A Background | -930 | 0.1 | 0–1 | lite | scroll | low |
| L006 | Cloud 3 | 2d | A Background | -920 | 0.12 | 0–1 | standard | scroll | low |
| L007 | Cloud 4 | 2d | A Background | -910 | 0.14 | 0–1 | standard | scroll | low |
| L008 | Haze band | 2d | A Background | -900 | 0.1 | 0–1 | standard | none | low |
| L009 | Dot pattern | 2d | A Background | -890 | 0.12 | 0–1 | standard | none | low |
| L010 | Film grain | 2d | A Background | -880 | 0 | 0–1 | full | none | medium |
| L011 | Vignette | 2d | A Background | -870 | 0 | 0–1 | lite | none | low |
| L012 | Night stars (dark mode) | 2d | A Background | -990 | 0.03 | 0–1 | standard | none | low |
| L013 | Low-rise rooftop 1 | 2.5d | B Far city | -700 | 0.16 | 0–1 | lite | scroll | low |
| L014 | Low-rise rooftop 2 | 2.5d | B Far city | -696 | 0.16 | 0–1 | standard | scroll | low |
| L015 | Low-rise rooftop 3 | 2.5d | B Far city | -692 | 0.16 | 0–1 | standard | scroll | low |
| L016 | Low-rise rooftop 4 | 2.5d | B Far city | -688 | 0.16 | 0–1 | lite | scroll | low |
| L017 | Low-rise rooftop 5 | 2.5d | B Far city | -684 | 0.16 | 0–1 | standard | scroll | low |
| L018 | Low-rise rooftop 6 | 2.5d | B Far city | -680 | 0.16 | 0–1 | standard | scroll | low |
| L019 | Low-rise rooftop 7 | 2.5d | B Far city | -676 | 0.16 | 0–1 | lite | scroll | low |
| L020 | Low-rise rooftop 8 | 2.5d | B Far city | -672 | 0.16 | 0–1 | standard | scroll | low |
| L021 | Low-rise rooftop 9 | 2.5d | B Far city | -668 | 0.16 | 0–1 | standard | scroll | low |
| L022 | Tree cluster 1 | 2.5d | B Far city | -660 | 0.2 | 0–1 | standard | scroll | low |
| L023 | Tree cluster 2 | 2.5d | B Far city | -656 | 0.2 | 0–1 | standard | scroll | low |
| L024 | Tree cluster 3 | 2.5d | B Far city | -652 | 0.2 | 0–1 | standard | scroll | low |
| L025 | Tree cluster 4 | 2.5d | B Far city | -648 | 0.2 | 0–1 | standard | scroll | low |
| L026 | Hill 1 | 2.5d | B Far city | -760 | 0.1 | 0–1 | lite | scroll | low |
| L027 | Hill 2 | 2.5d | B Far city | -754 | 0.12000000000000001 | 0–1 | standard | scroll | low |
| L028 | Hill 3 | 2.5d | B Far city | -748 | 0.14 | 0–1 | standard | scroll | low |
| L029 | Generic dome | 2.5d | B Far city | -690 | 0.16 | 0–1 | standard | scroll | low |
| L030 | Water tank | 2.5d | B Far city | -688 | 0.16 | 0–1 | full | scroll | low |
| L031 | Far power line 1 | 2.5d | B Far city | -640 | 0.22 | 0–1 | full | scroll | low |
| L032 | Far power line 2 | 2.5d | B Far city | -635 | 0.22 | 0–1 | full | scroll | low |
| L033 | Shop sign: Provisions | 2d | C Mid street | -320 | 0.42 | 0–1 | lite | scroll | low |
| L034 | Shop sign: Phones | 2d | C Mid street | -317 | 0.42 | 0–1 | lite | scroll | low |
| L035 | Shopper silhouette | 2d | C Mid street | -314 | 0.42 | 0–1 | lite | scroll | low |
| L036 | Seller silhouette | 2d | C Mid street | -311 | 0.42 | 0–1 | standard | scroll | low |
| L037 | Child with balloon | 2d | C Mid street | -308 | 0.42 | 0–1 | standard | scroll | low |
| L038 | Billboard: Open your store | 2d | C Mid street | -305 | 0.42 | 0–1 | standard | scroll | low |
| L039 | Street sign | 2d | C Mid street | -302 | 0.42 | 0–1 | standard | scroll | low |
| L040 | Okada rider silhouette | 2d | C Mid street | -299 | 0.42 | 0–1 | standard | scroll | low |
| L041 | Market stall | 2.5d | C Mid street | -280 | 0.5 | 0–1 | lite | scroll | low |
| L042 | Fruit stall | 2.5d | C Mid street | -276 | 0.5 | 0–1 | lite | scroll | low |
| L043 | Striped awning | 2.5d | C Mid street | -272 | 0.5 | 0–1 | lite | scroll | low |
| L044 | Blue awning | 2.5d | C Mid street | -268 | 0.5 | 0–1 | lite | scroll | low |
| L045 | Shop front: tailor | 2.5d | C Mid street | -264 | 0.5 | 0–1 | standard | scroll | low |
| L046 | Shop front: cakes | 2.5d | C Mid street | -260 | 0.5 | 0–1 | standard | scroll | low |
| L047 | Shop front: gadgets | 2.5d | C Mid street | -256 | 0.5 | 0–1 | standard | scroll | low |
| L048 | Danfo-style bus | 2.5d | C Mid street | -252 | 0.5 | 0–1 | standard | scroll | low |
| L049 | Parked bike | 2.5d | C Mid street | -248 | 0.5 | 0–1 | standard | scroll | low |
| L050 | Parked okada | 2.5d | C Mid street | -244 | 0.5 | 0–1 | full | scroll | low |
| L051 | Kiosk | 2.5d | C Mid street | -240 | 0.5 | 0–1 | full | scroll | low |
| L052 | Umbrella stand | 2.5d | C Mid street | -236 | 0.5 | 0–1 | full | scroll | low |
| L053 | 3D stall | 3d | C Mid street | -220 | 0.55 | 0–1 | standard | scroll | medium |
| L054 | 3D kiosk | 3d | C Mid street | -214 | 0.55 | 0–1 | full | scroll | medium |
| L055 | 3D bike | 3d | C Mid street | -208 | 0.55 | 0–1 | full | scroll | medium |
| L056 | 3D parasol | 3d | C Mid street | -202 | 0.55 | 0–1 | full | scroll | medium |
| L057 | Phone showing a store page | 3d | D Hero objects | 0 | 0.7 | 0–0.6 | lite | pointer | medium |
| L058 | Storefront stall | 3d | D Hero objects | 20 | 0.72 | 0.1–0.7 | standard | scroll | medium |
| L059 | Delivery scooter and rider | 3d | D Hero objects | 40 | 0.85 | 0.2–1 | standard | scroll | high |
| L060 | Order tag | 3d | D Hero objects | 60 | 0.9 | 0.3–1 | full | pointer | medium |
| L061 | Cart | 3d | D Hero objects | 50 | 0.88 | 0.1–0.9 | full | pointer | medium |
| L062 | Floating map pin 1 | 3d | D Hero objects | 10 | 0.6 | 0–1 | standard | pointer | medium |
| L063 | Floating map pin 2 | 3d | D Hero objects | 16 | 0.65 | 0–1 | standard | pointer | medium |
| L064 | Floating map pin 3 | 3d | D Hero objects | 22 | 0.7 | 0–1 | full | pointer | medium |
| L065 | Floating map pin 4 | 3d | D Hero objects | 28 | 0.75 | 0–1 | full | pointer | medium |
| L066 | Floating map pin 5 | 3d | D Hero objects | 34 | 0.8 | 0–1 | full | pointer | medium |
| L067 | Floating map pin 6 | 3d | D Hero objects | 40 | 0.85 | 0–1 | full | pointer | medium |
| L068 | Parcel box 1 | 3d | D Hero objects | 30 | 0.8 | 0.2–1 | standard | scroll | medium |
| L069 | Parcel box 2 | 3d | D Hero objects | 34 | 0.8300000000000001 | 0.2–1 | full | scroll | medium |
| L070 | Parcel box 3 | 3d | D Hero objects | 38 | 0.8600000000000001 | 0.2–1 | full | scroll | medium |
| L071 | Parcel box 4 | 3d | D Hero objects | 42 | 0.89 | 0.2–1 | full | scroll | medium |
| L072 | Parcel box 5 | 3d | D Hero objects | 46 | 0.92 | 0.2–1 | full | scroll | medium |
| L073 | WhatsApp message bubble | 2d | E Interface | 180 | 0.95 | 0–1 | lite | scroll | low |
| L074 | Icon bubble: store | 2d | E Interface | 184 | 0.95 | 0.08–1 | lite | scroll | low |
| L075 | Icon bubble: truck | 2d | E Interface | 188 | 0.95 | 0.16–1 | lite | scroll | low |
| L076 | Connector line 1 | 2d | E Interface | 192 | 0.95 | 0.24–1 | standard | scroll | low |
| L077 | Connector line 2 | 2d | E Interface | 196 | 0.95 | 0.32–1 | standard | scroll | low |
| L078 | Step marker 1 | 2d | E Interface | 200 | 0.95 | 0.4–1 | standard | scroll | low |
| L079 | Step marker 2 | 2d | E Interface | 204 | 0.95 | 0.48–1 | standard | scroll | low |
| L080 | Step marker 3 | 2d | E Interface | 208 | 0.95 | 0.56–1 | standard | scroll | low |
| L081 | Floating card: New order | 2.5d | E Interface | 200 | 1 | 0–1 | lite | hover | low |
| L082 | Floating card: Awaiting your confirmation | 2.5d | E Interface | 206 | 1.06 | 0.07–1 | lite | hover | low |
| L083 | Floating card: Paid (confirmed by seller) | 2.5d | E Interface | 212 | 1.12 | 0.14–1 | standard | hover | low |
| L084 | Floating card: Out for delivery | 2.5d | E Interface | 218 | 1 | 0.21000000000000002–1 | standard | hover | low |
| L085 | Floating card: Ready for pickup | 2.5d | E Interface | 224 | 1.06 | 0.28–1 | standard | hover | low |
| L086 | Floating card: Delivered | 2.5d | E Interface | 230 | 1.12 | 0.35000000000000003–1 | full | hover | low |
| L087 | Floating card: Share your store link | 2.5d | E Interface | 236 | 1 | 0.42000000000000004–1 | full | hover | low |
| L088 | Floating card: Open now | 2.5d | E Interface | 242 | 1.06 | 0.49000000000000005–1 | full | hover | low |
| L089 | Foreground leaf 1 | 2d | F Foreground | 400 | 1.35 | 0–1 | standard | scroll | low |
| L090 | Foreground leaf 2 | 2d | F Foreground | 405 | 1.35 | 0–1 | full | scroll | low |
| L091 | Foreground leaf 3 | 2d | F Foreground | 410 | 1.35 | 0–1 | full | scroll | low |
| L092 | Foreground leaf 4 | 2d | F Foreground | 415 | 1.35 | 0–1 | full | scroll | low |
| L093 | Dust motes 1 | 2d | F Foreground | 380 | 1.2 | 0–1 | full | none | low |
| L094 | Dust motes 2 | 2d | F Foreground | 385 | 1.2 | 0–1 | full | none | low |
| L095 | Dust motes 3 | 2d | F Foreground | 390 | 1.2 | 0–1 | full | none | low |
| L096 | Light rays | 2d | F Foreground | 360 | 0.3 | 0–1 | standard | none | medium |
| L097 | Edge blur left | 2d | F Foreground | 420 | 0 | 0–1 | full | none | medium |
| L098 | Edge blur right | 2d | F Foreground | 420 | 0 | 0–1 | full | none | medium |
| L099 | Cursor glow | 2d | F Foreground | 440 | 0 | 0–1 | standard | pointer | low |
| L100 | Scroll progress rail | 2d | F Foreground | 460 | 0 | 0–1 | lite | scroll | low |
