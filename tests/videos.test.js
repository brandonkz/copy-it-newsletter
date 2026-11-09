import assert from "node:assert/strict";
import test from "node:test";
import videosFile from "../data/videos.json" with { type: "json" };

const expected = [
  ["golf-simulator-trailer", "TikTok", "7704985126618369301", "20,400 plays on TikTok"],
  ["corporate-cake-gifting", "TikTok", "7705738523663404340", "6,612 plays on TikTok"],
  ["couch-flip", "YouTube", "6N9BkhN_1Mk", undefined],
  ["cowboy-stock-tank-pools", "YouTube", "xBd1sD2yIKo", undefined],
  ["sandwich-board", "YouTube", "sCuTwB7ZcIY", undefined],
  ["saturday-micro-bakery", "YouTube", "8nwJFOI6C80", undefined],
];

test("video cards are the six published breakdowns, in order", () => {
  assert.equal(videosFile.videos.length, 6);
  assert.doesNotMatch(JSON.stringify(videosFile), /Tool Library|Library of Things|Universal Yums|thetoollibrary|libraryofthings|universalyums/i);
  videosFile.videos.forEach((video, index) => {
    const [slug, platform, videoId, stat] = expected[index];
    assert.equal(video.slug, slug);
    assert.equal(video.platform, platform);
    assert.equal(video.videoId, videoId);
    assert.equal(video.url.includes(videoId), true);
    assert.equal(video.stat, stat);
    assert.doesNotMatch(video.place, /south africa/i);
    if (!stat) assert.doesNotMatch(`${video.title} ${video.description}`, /\d/);
  });
});
