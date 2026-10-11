import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { AdminSessionsController } from "./Controllers/AdminSessionsController";
import { MessagesController } from "./Controllers/MessagesController";
import { SettingsController } from "./Controllers/SettingsController";
import { UsersController } from "./Controllers/UsersControllers";
import { AppConfig } from "./config";
import { ensureAdmin } from "./middlewares/ensureAdmin";

export function createRoutes(config: AppConfig): Router {
  const routes = Router();
  const adminSessionsController = new AdminSessionsController(config);
  const messagesController = new MessagesController();
  const settingsController = new SettingsController();
  const usersController = new UsersController();
  const adminOnly = ensureAdmin(config.jwtSecret, config.adminId);
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      error: "Muitas tentativas de login. Tente novamente em alguns minutos.",
    },
  });

  routes.post("/admin/session", loginLimiter, adminSessionsController.handle);

  // The client only needs to know whether support is currently available.
  routes.get("/settings/:username", settingsController.findByUsername);

  routes.post("/settings", adminOnly, settingsController.create);
  routes.put("/settings/:username", adminOnly, settingsController.update);
  routes.post("/users", adminOnly, usersController.create);
  routes.post("/messages", adminOnly, messagesController.create);
  routes.get("/messages/:id", adminOnly, messagesController.showByUser);

  return routes;
}
