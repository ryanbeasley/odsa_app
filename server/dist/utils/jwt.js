"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signToken = signToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
function signToken(user) {
    const secret = env_1.JWT_SECRET;
    const options = { expiresIn: env_1.TOKEN_EXPIRY };
    return jsonwebtoken_1.default.sign({
        sub: String(user.id),
        email: user.email,
        role: user.role,
    }, secret, options);
}
