import { getChatHomeSuggestions } from "../web/src/lib/chat-home-suggestions.ts";

const chat = getChatHomeSuggestions("chat");
if (!chat || chat.tasks.length < 3) {
  throw new Error("Chat suggestions should keep the default research tasks");
}

const threeD = getChatHomeSuggestions("3d");
if (!threeD || threeD.tasks.length < 3) {
  throw new Error("3D suggestions should expose industrial drawing starter tasks");
}

const joined3d = threeD.tasks.map((task) => task.label).join("\n");
for (const required of ["安装支架", "OpenSCAD", "DXF", "STL"]) {
  if (!joined3d.includes(required)) {
    throw new Error(`3D suggestions are missing required phrase: ${required}`);
  }
}

const video = getChatHomeSuggestions("video");
if (!video || video.tasks.length < 3) {
  throw new Error("Video suggestions should expose web video starter tasks");
}

const joinedVideo = video.tasks.map((task) => task.label).join("\n");
for (const required of ["60 秒", "产品介绍视频", "90 秒讲解视频", "16:9"]) {
  if (!joinedVideo.includes(required)) {
    throw new Error(`Video suggestions are missing required phrase: ${required}`);
  }
}

if (getChatHomeSuggestions("writing") !== null) {
  throw new Error("Writing keeps the template gallery instead of starter tasks");
}

if (getChatHomeSuggestions("ppt") !== null) {
  throw new Error("PPT keeps the template gallery instead of starter tasks");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      chatTasks: chat.tasks.length,
      threeDTasks: threeD.tasks.length,
      videoTasks: video.tasks.length,
      threeDHeading: threeD.heading,
      videoHeading: video.heading,
    },
    null,
    2,
  ),
);
