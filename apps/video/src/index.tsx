import React from "react";
import { registerRoot } from "remotion";
import { Composition } from "remotion";
import { XiaochuangPromo } from "./compositions/XiaochuangPromo";
import { VIDEO } from "./constants";

const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="XiaochuangPromo"
      component={XiaochuangPromo}
      durationInFrames={VIDEO.durationInFrames}
      fps={VIDEO.fps}
      width={VIDEO.width}
      height={VIDEO.height}
    />
  );
};

registerRoot(RemotionRoot);
