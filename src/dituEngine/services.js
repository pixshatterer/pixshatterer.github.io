import { fetchHandler } from "./fetchHandler";

const { get } = fetchHandler();

export async function getContentDetail(content) {
  const response = await get(`/CONTENT/DETAIL/${content}`);
  return response;
}

export async function getContentUserData(content) {
  const response = await get(`/CONTENT/USERDATA/${content}`, {priority: "high"});
  return response;
}

export async function getNextEpisode(contentId) {
  const response = await get(`/CONTENT/NEXT-EPISODE/${contentId}`);
  return response;
}

export async function getContentVideoUrl({
  contentType,
  id,
  assetId,
  withCredentials = true,
}) {
  const response = await get(
    `/CONTENT/VIDEOURL/${contentType}/${id}/${assetId}`,
    withCredentials ? { credentials: "include" } : {}
  );
  return response;
}
export async function getDeviceSessions({ contentType, id, assetId }) {
  const response = await get(
    `/USER/DEVICESESSIONS/${contentType}/${id}/${assetId}`,
    { credentials: "include" }
  );
  return response;
}

export async function getFutureProgramsBychannelId({
  channelId,
  airingEndTime = "now",
  // airingEndTime = null,
}) {
  const endTime = airingEndTime;
  // const now = new Date();
  // const startTime = airingEndTime ? airingEndTime - 2000 : now.getTime();
  // const endTime = startTime + 6 * 60 * 60 * 1000; // ? equivalente a 6 horas de programação
  const response = await get(
    `/TRAY/SEARCH/PROGRAM?filter_channelIds=${channelId}&filter_airingTime=${endTime}`
  );
  return response;
}

export async function getAirinProgramBychannelId({ channelId }) {
  const response = await get(
    `/TRAY/SEARCH/PROGRAM?filter_channelIds=${channelId}&filter_airingTime=now`
  );
  return response;
}