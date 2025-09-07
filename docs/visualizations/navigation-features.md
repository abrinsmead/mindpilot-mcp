# Navigation Feature Visualizations

## Enhanced Navigation Features

```mermaid
graph TB
  subgraph "Mouse Navigation 🖱️"
    MW[Mouse Wheel]
    MW --> MWV[Regular Scroll<br/>↕ Vertical Pan]
    MW --> MWH[Shift + Scroll<br/>↔ Horizontal Pan]
    MW --> MWZ[Ctrl/Cmd + Scroll<br/>🔍 Zoom In/Out]
    
    MD[Mouse Drag]
    MD --> PAN[Click & Drag<br/>to Pan]
  end

  subgraph "Keyboard Navigation ⌨️"
    ARROWS[Arrow Keys]
    ARROWS --> UP[↑ Pan Up]
    ARROWS --> DOWN[↓ Pan Down]
    ARROWS --> LEFT[← Pan Left]
    ARROWS --> RIGHT[→ Pan Right]
    ARROWS --> DIAG[↖↗↙↘ Diagonal<br/>Multi-key Support]
    
    ZOOM[Zoom Keys]
    ZOOM --> PGU[PageUp<br/>🔍 Zoom In]
    ZOOM --> PGD[PageDown<br/>🔍 Zoom Out]
    ZOOM --> FIT[F Key<br/>⊡ Fit to Screen]
  end

  subgraph "Navigation Features ✨"
    SMOOTH[Smooth Movement]
    SMOOTH --> ACC[Acceleration<br/>on Hold]
    SMOOTH --> NORM[Diagonal<br/>Normalization]
    
    CONFIG[Configuration]
    CONFIG --> SPEED[Pan Speed: 8px]
    CONFIG --> ACCEL[Acceleration: 1.05x]
    CONFIG --> MAX[Max Speed: 25px]
  end

  subgraph "Implementation Details 🔧"
    HOOK1[usePanZoom Hook]
    HOOK1 --> WHEEL[Wheel Handler]
    HOOK1 --> MOUSE[Mouse Handlers]
    HOOK1 --> KEYPAN[handleKeyPan]
    
    HOOK2[useKeyboardPanning Hook]
    HOOK2 --> KEYSTATE[Key State Tracking]
    HOOK2 --> ANIM[Animation Frame]
    HOOK2 --> VEL[Velocity Calculation]
  end

  subgraph "User Experience 🎯"
    UX1[Natural Scrolling]
    UX1 --> SC1[Scroll = Pan<br/>(Expected Behavior)]
    
    UX2[Responsive Controls]
    UX2 --> SC2[Instant Response]
    UX2 --> SC3[Smooth Acceleration]
    
    UX3[Intuitive Modifiers]
    UX3 --> SC4[Shift for Horizontal]
    UX3 --> SC5[Ctrl for Zoom]
  end

  MW -.-> HOOK1
  ARROWS -.-> HOOK2
  HOOK2 -.-> KEYPAN
  SMOOTH -.-> HOOK2
  CONFIG -.-> HOOK2

  classDef coral fill:#ff6b6b,stroke:#c92a2a,color:#fff
  classDef ocean fill:#4c6ef5,stroke:#364fc7,color:#fff
  classDef forest fill:#51cf66,stroke:#2f9e44,color:#fff
  classDef sunshine fill:#ffd43b,stroke:#fab005,color:#000
  classDef grape fill:#845ef7,stroke:#5f3dc4,color:#fff
  classDef teal fill:#20c997,stroke:#12b886,color:#fff
  
  class MW,MD,ARROWS,ZOOM coral
  class MWV,MWH,MWZ,PAN,UP,DOWN,LEFT,RIGHT,DIAG,PGU,PGD,FIT ocean
  class SMOOTH,CONFIG,SPEED,ACCEL,MAX,ACC,NORM forest
  class HOOK1,HOOK2,WHEEL,MOUSE,KEYPAN,KEYSTATE,ANIM,VEL grape
  class UX1,UX2,UX3,SC1,SC2,SC3,SC4,SC5 teal
```

## Before vs After Comparison

```mermaid
graph LR
  subgraph "BEFORE ❌"
    B1[Mouse Wheel]
    B1 --> BZ[Only Zoom]
    
    B2[Arrow Keys]
    B2 --> BD[Discrete 50px jumps]
    B2 --> BN[No diagonal movement]
    B2 --> BA[No acceleration]
    
    B3[Zoom Keys]
    B3 --> BZK[↑↓ for Zoom]
    
    B4[Issues]
    B4 --> BI1[Wheel zoom unexpected]
    B4 --> BI2[Jerky keyboard movement]
    B4 --> BI3[No multi-directional support]
  end

  subgraph "AFTER ✅"
    A1[Mouse Wheel]
    A1 --> AP[Default: Pan viewport]
    A1 --> AH[Shift: Horizontal pan]
    A1 --> AZ[Ctrl/Cmd: Zoom]
    
    A2[Arrow Keys]
    A2 --> AS[Smooth continuous movement]
    A2 --> AD[8-way diagonal support]
    A2 --> AA[Acceleration 1.05x → 25px max]
    
    A3[Zoom Keys]
    A3 --> AZK[PageUp/PageDown for Zoom]
    A3 --> AF[F for Fit to Screen]
    
    A4[Benefits]
    A4 --> AB1[Natural scrolling behavior]
    A4 --> AB2[Fluid navigation]
    A4 --> AB3[Gaming-like controls]
  end

  subgraph "Technical Changes 🔧"
    T1[New Hook]
    T1 --> TH[useKeyboardPanning]
    TH --> TH1[requestAnimationFrame]
    TH --> TH2[Key state tracking]
    TH --> TH3[Velocity calculation]
    
    T2[Modified Hook]
    T2 --> TM[usePanZoom]
    TM --> TM1[Wheel event handler]
    TM --> TM2[Pan mode detection]
    TM --> TM3[handleKeyPan method]
    
    T3[Test Coverage]
    T3 --> TC[27 tests passing]
    T3 --> TR[Refactored structure]
  end

  B1 -.->|Improved| A1
  B2 -.->|Enhanced| A2
  B3 -.->|Remapped| A3
  B4 -.->|Resolved| A4
  
  A2 --> T1
  A1 --> T2

  classDef bad fill:#ff6b6b,stroke:#c92a2a,color:#fff
  classDef good fill:#51cf66,stroke:#2f9e44,color:#fff
  classDef tech fill:#4c6ef5,stroke:#364fc7,color:#fff
  classDef neutral fill:#ffd43b,stroke:#fab005,color:#000
  
  class B1,B2,B3,B4,BZ,BD,BN,BA,BZK,BI1,BI2,BI3 bad
  class A1,A2,A3,A4,AP,AH,AZ,AS,AD,AA,AZK,AF,AB1,AB2,AB3 good
  class T1,T2,T3,TH,TM,TH1,TH2,TH3,TM1,TM2,TM3,TC,TR tech
```

## User Interaction Flow

```mermaid
flowchart TD
  Start([User wants to navigate diagram])
  
  Start --> Choice{Choose Input Method}
  
  Choice --> Mouse[🖱️ Mouse]
  Choice --> Keyboard[⌨️ Keyboard]
  
  Mouse --> MW{Mouse Wheel Action?}
  MW --> Scroll[Regular Scroll]
  MW --> ShiftScroll[Shift + Scroll]
  MW --> CtrlScroll[Ctrl/Cmd + Scroll]
  
  Scroll --> VPan[✅ Pans Vertically<br/>Natural scrolling]
  ShiftScroll --> HPan[✅ Pans Horizontally<br/>Side-to-side movement]
  CtrlScroll --> Zoom[✅ Zooms In/Out<br/>Focus on cursor]
  
  Mouse --> Drag[Click & Drag]
  Drag --> FreePan[✅ Free Pan<br/>Move in any direction]
  
  Keyboard --> Keys{Which Keys?}
  
  Keys --> Arrows[Arrow Keys ↑↓←→]
  Keys --> PageKeys[PageUp/PageDown]
  Keys --> FKey[F Key]
  
  Arrows --> Single[Single Arrow]
  Arrows --> Multiple[Multiple Arrows]
  
  Single --> Move4[✅ Move in 4 directions<br/>Smooth acceleration]
  Multiple --> Move8[✅ Move in 8 directions<br/>Diagonal movement]
  
  PageKeys --> ZoomKB[✅ Zoom In/Out<br/>Center-based zoom]
  FKey --> Fit[✅ Fit to Screen<br/>Auto-scale diagram]
  
  VPan --> Result([Smooth Navigation Experience])
  HPan --> Result
  Zoom --> Result
  FreePan --> Result
  Move4 --> Result
  Move8 --> Result
  ZoomKB --> Result
  Fit --> Result
  
  style Start fill:#e1f5fe
  style Result fill:#c8e6c9
  style Choice fill:#fff3e0
  style MW fill:#fff3e0
  style Keys fill:#fff3e0
  
  classDef action fill:#4c6ef5,stroke:#364fc7,color:#fff
  classDef result fill:#51cf66,stroke:#2f9e44,color:#fff
  classDef input fill:#ff6b6b,stroke:#c92a2a,color:#fff
  
  class Scroll,ShiftScroll,CtrlScroll,Drag,Single,Multiple,PageKeys,FKey action
  class VPan,HPan,Zoom,FreePan,Move4,Move8,ZoomKB,Fit result
  class Mouse,Keyboard input
```