import {
  getContentDetail,
  getContentUserData,
  getContentVideoUrl,
  getAirinProgramBychannelId,
} from "./services";

const functions = {
  handleSSAICustomParams: (url, custParamsArray) => {
    if (custParamsArray.length === 0) return url;
    const urlObj = new URL(url);
    const params = new URLSearchParams(urlObj.search);
    for (let i = 0; i < custParamsArray.length; i++) {
      params.append(`ads.${custParamsArray[i].key}`, custParamsArray[i].value);
    }
    urlObj.search = params.toString();
    // return updated url
    return urlObj.href;
  },
  getSSAICustomParams: () => {
    const customParams = [{ key: "deviceType", value: "TV" }];
    customParams.push({
      key: "rdid",
      value: crypto.randomUUID(),
    });
    customParams.push({ key: "is_lat", value: true });
    customParams.push({ key: "idtype", value: "tifa" });
    customParams.push({ key: "vpa", value: "click" });
    return customParams;
  },
  resolveUri: async ({ assets, contentType, id, withCredentials = true }) => {
    let result;
    const bestMasterAsset = await findBestMasterAsset(assets);

    const contentVideoUrl = await getContentVideoUrl({
      contentType,
      id,
      assetId: bestMasterAsset.assetId,
      withCredentials,
    });

    const {
      resultObj: { src, token },
    } = contentVideoUrl;
    const customParams = functions.getSSAICustomParams();
    const srcWithParams = functions.handleSSAICustomParams(src, customParams);
    if (contentType === "LIVE") {
      result = {
        src: srcWithParams,
        token,
        asset: bestMasterAsset,
      };
    } else {
      result = {
        src: srcWithParams,
        token,
        asset: bestMasterAsset,
        assetId: bestMasterAsset.assetId,
      };
    }

    return result;
  },
  checkEntitlement: async ({ contentType, id }) => {
    const contentUserData = await getContentUserData(`${contentType}/${id}`);
    const {
      resultObj: { containers },
    } = contentUserData;
    const { entitlement } = containers[0];
    const fieldsToCheck = [
      "isPCBlocked",
      "isContentOOHBlocked",
      "isGeofencedBlocked",
      "isSportBlackoutBlocked",
      "isPlatformBlacklisted",
      "isChannelNotSubscribed",
      "isGeoBlocked",
    ];
    for (let field of fieldsToCheck) {
      if (entitlement[field]) {
        return true;
      }
    }
    return false;
  },
  getAiringPrograms: async (channelId) => {
    const airingProgramContentDetail = await getAirinProgramBychannelId({
      channelId,
    });
    const hasLiveProgram =
      airingProgramContentDetail.resultObj.containers.length > 0;
    if (!hasLiveProgram) {
      const error = new Error("Program not available");
      error.errorCode = "playerErrorEnums.PROGRAM_NOT_AVAILABLE";
      throw error;
    }
    return airingProgramContentDetail;
  },
  getFuturePrograms: async (channelId, airingEndTime) => {
    const nextProgramContentDetail = await getFutureProgramsBychannelId({
      channelId,
      airingEndTime,
    });
    return nextProgramContentDetail;
  },
  setupPlayerDsl: async ({ contentType, id }) => {
    const isVod = contentType === "VOD";
    let airingProgramContentDetail = { resultObj: { containers: [] } };
    if (!isVod) {
      airingProgramContentDetail = await functions.getAiringPrograms(id);
    }
    const isBlocked = await functions.checkEntitlement({
      contentType: isVod ? contentType : "LIVE",
      id,
    });
    if (isBlocked) {
      return;
    }
    if (isVod) {
      functions.getVodNextEpisode({
        contentId: id,
        contentType,
      });
      return functions.setupPlayerVod({ contentId: id });
    }
    return functions.setupPlayerLinear({
      contentType: "LIVE",
      channelId: id,
      airingProgramContentDetail,
    });
  },
  setupPlayerVod: async ({ contentId }) => {
    const contentDetail = await getContentDetail(`VOD/${contentId}`);
    const { assets, parents } = contentDetail.resultObj.containers[0];
    const videoDetails = await functions.resolveUri({
      assets,
      contentType: "VOD",
      id: contentId,
      withCredentials: true,
    });
    const mediaMetadata = {
      ...contentDetail.resultObj.containers[0].metadata,
      videoType: videoDetails.asset.videoType,
    };
    const result = {
      mediaUrl: videoDetails.src,
      mediaToken: videoDetails.token,
      assetId: videoDetails.assetId,
      mediaMetadata,
    };
    result.mediaMetadata.parents = parents;
    return result;
  },
  setupPlayerLinear: async ({
    contentType,
    channelId,
    airingProgramContentDetail,
  }) => {
    const trayLiveChannelsHashMap = {} // pass it via customData
    const {
      config: {
        configs: {
          logos: { player },
        },
      },
    } = configApp;
    const playerLogo = player;
    const channel = trayLiveChannelsHashMap[channelId];
    const assets = channel.assets;

    const channelType = channel?.metadata?.extendedMetadata?.channelType;

    const liveProgram = airingProgramContentDetail.resultObj.containers[0];
    const videoDetails = await functions.resolveUri({
      assets,
      contentType:
        contentType && contentType === "PROGRAM" ? "LIVE" : contentType,
      id: channelId,
      withCredentials: true,
    });
    const mediaMetadata = {
      ...liveProgram.metadata,
      externalId: channel.metadata.externalId,
      videoType: videoDetails.asset.videoType,
      channelId,
      advTags: channel.metadata.advTags,
    };

    const result = {
      channelType,
      mediaMetadata,
      mediaUrl: videoDetails.src,
      mediaToken: videoDetails.token,
      channelLogo: playerLogo ? playerLogo : null,
    };

    return result;
  },
};

/*
utils
*/
const videoQualityRatings = {
  SD: 1,
  HD: 2,
  UHD: 3,
};

async function findBestMasterAsset(assets) {
  const masters = await assets.filter((asset) => asset.assetType === "MASTER");
  const highestQualityMaster = await masters.reduce((acc, current) => {
    return videoQualityRatings[current.videoType] >
      videoQualityRatings[acc.videoType]
      ? current
      : acc;
  });
  return highestQualityMaster;
}

function findBestChannelLogo(asset) {
  const result = asset.logoBig || asset.logoMedium || asset.logoSmall;
  if (result) {
    return result;
  }
  return null;
}

export default functions;
