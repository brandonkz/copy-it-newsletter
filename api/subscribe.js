import { subscribeHandler } from "../lib/subscribe.js";

export default function handler(req, res) {
  return subscribeHandler(req, res);
}
