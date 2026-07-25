import React from "react";
import { Composition } from "remotion";
import { HeroReel } from "./HeroReel";

export const RemotionRoot: React.FC = () => (
  <Composition
    id="HeroReel"
    component={HeroReel}
    durationInFrames={190}
    fps={30}
    width={1280}
    height={720}
  />
);
