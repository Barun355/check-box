import Redis from "ioredis";
import type { CheckboxStateI } from "./types";
import { MAX_ARRAY_COUNT } from "./constant";

class RedisResponse {
  success: boolean;
  data: any;
  error?: string;

  constructor(success: boolean, data: any, error?: string) {
    this.success = success;
    this.data = data;
    this.error = error;
  }
}

class RedisError extends Error {
  data: any;

  constructor(message: string) {
    super(message);
    this.name = "RedisError";
    this.data = null;
  }
}

function createRedisConnection() {
  return new Redis({
    host: "localhost",
    port: 6379,
  });
}

export const redis = createRedisConnection();
export const publisher = createRedisConnection();
export const subscriber = createRedisConnection();

export class RedisAdapter {
  redisClient: Redis;

  constructor(redisClient: Redis) {
    this.redisClient = redisClient;
  }

  // Users Adapter Code
  async getTotalUsers() {
    try {
      const result = await this.redisClient.get("totalUsers");

      console.log("getTotalUsers:", result);

      if (!result) {
        this.redisClient.set("totalUsers", 0);
        return new RedisResponse(false, null, "Users Count 0");
      }

      return new RedisResponse(true, { totalUsers: Number(result) });
    } catch (error) {
      console.log("Redis:Error:getTotalUsers()", error);
      throw new RedisError("Redis:Error:getTotalUsers()");
    }
  }

  async getUserById(userId: string) {
    try {
      let users = await this.redisClient.get("users");
      if (!users) {
        console.error("Error fetching users from Redis: No users found");
        throw new RedisError("failed to fetch users");
      }
      users = JSON.parse(users);

      if (!Object.keys(users as any).includes(userId)) {
        return new RedisResponse(false, null, "No user found with the id");
      }

      return new RedisResponse(true, (users as any)[userId]);
    } catch (error) {
      console.log("Redis Error", error);
      throw new RedisError("Redis:Error:getUsers()");
    }
  }

  async getUsers() {
    try {
      const users = await this.redisClient.get("users");

      if (!users) {
        this.redisClient.set("users", JSON.stringify({}));
        console.error("Error fetching users from Redis: No users found");
        return new RedisResponse(false, null, "failed to fetch users");
      }

      return new RedisResponse(true, JSON.parse(users));
    } catch (error) {
      console.log("Redis Error", error);
      throw new RedisError("Redis:Error:getUsers()");
    }
  }

  async addUser(userId: string, colorAssigned: string) {
    try {
      const users = await this.getUsers();

      if (Object.keys(users.data).includes(userId)) {
        return new RedisResponse(true, users.data[userId]);
      }
      users.data[userId] = { id: userId, colorAssigned };
      await this.redisClient.set("users", JSON.stringify(users.data));
      await this.redisClient.incr("totalUsers");

      console.log("userAdded at Redis: ", users.data);
      return new RedisResponse(true, { user: users.data[userId] });
    } catch (error) {
      console.log("Redis:Error:addUser", error);
      throw new RedisError("Redis:Error:addUser");
    }
  }

  async decreaseUserCount(userId: string) {
    try {
      const users = await this.getUsers();

      if (!Object.keys(users.data).includes(userId)) {
        return new RedisResponse(false, null, "User do not exists");
      }
      delete users.data[userId];

      await this.redisClient.set("users", JSON.stringify(users.data));
      await this.redisClient.decr("totalUsers");

      return new RedisResponse(true, { user: users.data[userId] });
    } catch (error) {
      console.log("Redis:Error:decreaseUserCount", error);
      throw new RedisError("Redis:Error:decreaseUserCount");
    }
  }

  // Checkbox Adapters Code
  async getCheckboxes() {
    try {
      let checkboxes = await this.redisClient.get("checkboxes");

      if (!checkboxes) {
        this.redisClient.set(
          "checkboxes",
          JSON.stringify(
            new Array(MAX_ARRAY_COUNT)
              .fill(false)
              .map(() => ({ state: false, userId: null, styles: {} })),
          ),
        );
        return new RedisResponse(false, null, "No checkboxes found");
      }
      checkboxes = JSON.parse(checkboxes);

      if (!Array.isArray(checkboxes)) {
        return new RedisResponse(false, null, "Checkbox data format is wrong");
      }

      return new RedisResponse(true, checkboxes);
    } catch (error) {
      console.log("Redis:Error:getCheckboxes", error);
      return new RedisError("Redis:Error:getCheckboxes");
    }
  }

  async updateCheckbox(index: number, checkboxState: CheckboxStateI) {
    try {
      let checkboxes = await this.redisClient.get("checkboxes");

      if (!checkboxes) {
        return new RedisResponse(false, null, "No checkboxes found");
      }
      checkboxes = JSON.parse(checkboxes);

      if (!Array.isArray(checkboxes)) {
        return new RedisResponse(false, null, "Checkbox data format is wrong");
      }

      checkboxes[index]!.state = checkboxState.state;
      checkboxes[index]!.userId = checkboxState.userId;
      checkboxes[index]!.styles = checkboxState.styles;

      await this.redisClient.set("checkboxes", JSON.stringify(checkboxes));

      return new RedisResponse(true, checkboxes[index]);
    } catch (error) {
      console.log("Redis:Error:updateCheckbox", error);
      return new RedisError("Redis:Error:updateCheckbox");
    }
  }

  async clearUserFromCheckboxes(userId: string) {
    try {
      let checkboxes = await this.redisClient.get("checkboxes");

      if (!checkboxes) {
        return new RedisResponse(false, null, "No checkboxes found");
      }
      checkboxes = JSON.parse(checkboxes);

      console.log("clearUserFromCheckboxes:checkboxes", checkboxes);

      if (!Array.isArray(checkboxes)) {
        return new RedisResponse(false, null, "Checkbox data format is wrong");
      }

      for (let i = 0; i < checkboxes.length; i++) {
        if (checkboxes[i]!.userId === userId) {
          checkboxes[i]!.userId = null;
        }
      }

      await this.redisClient.set("checkboxes", JSON.stringify(checkboxes));
      return new RedisResponse(true, { Ok: true });
    } catch (error) {
      console.log("Redis:Error:clearUserFromCheckbox", error);
      return new RedisError("Redis:Error:clearUserFromCheckbox");
    }
  }
}

export const redisAdapter = new RedisAdapter(redis);
