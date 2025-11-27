"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const env_1 = require("./config/env");
const authController_1 = __importDefault(require("./controllers/authController"));
const homeController_1 = __importDefault(require("./controllers/homeController"));
const eventsController_1 = __importDefault(require("./controllers/eventsController"));
const settingsController_1 = __importDefault(require("./controllers/settingsController"));
const pushService_1 = require("./services/pushService");
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', process.env.CORS_ORIGIN ?? '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }
    next();
});
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', pushConfigured: Boolean(env_1.EXPO_PUSH_TOKEN) });
});
app.use('/api', authController_1.default);
app.use('/api', homeController_1.default);
app.use('/api', eventsController_1.default);
app.use('/api', settingsController_1.default);
const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`API listening on http://localhost:${port}`);
    (0, pushService_1.startEventAlertScheduler)();
});
