import Redis from "ioredis";

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
  constructor(message: string) {
    super(message);
    this.name = "RedisError";
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

    this.redisClient.set("totalUsers", 0);
    this.redisClient.set("users", JSON.stringify({}))
  }

  async getTotalUsers() {
    try {
        const result = await this.redisClient.get("totalUsers")
        
        console.log('getTotalUsers:', result)

        if(!result) {
            throw new RedisError("Users Count 0")
        }
    
        return new RedisResponse(true, {totalUsers: Number(result)})
    } catch (error) {
        console.log('Redis:Error:getTotalUsers()', error)
        throw new RedisError("Redis:Error:getTotalUsers()")
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
            return new RedisResponse(false, null, "No user found with the id")
        }

        return new RedisResponse(true, (users as any)[userId]);
    } catch (error) {
        console.log('Redis Error', error)
        throw new RedisError("Redis:Error:getUsers()")
    }
  }

  async getUsers() {
    try {
        const users = await this.redisClient.get("users");
    
        if (!users) {
          console.error("Error fetching users from Redis: No users found");
          throw new RedisError("failed to fetch users");
        }
    
        return new RedisResponse(true, JSON.parse(users));
    } catch (error) {
        console.log('Redis Error', error)
        throw new RedisError("Redis:Error:getUsers()")
    }
  }

  async increaseUserCount(userId: string, colorAssigned: string) {

    try {
        const users = await this.getUsers();
    
        if (Object.keys(users.data).includes(userId)) {
            return new RedisResponse(true, users.data[userId]);
        }
        users.data[userId] = { id: userId, colorAssigned };
        await this.redisClient.set("users", JSON.stringify(users.data));
        await this.redisClient.incr("totalUsers");
    
        return new RedisResponse(true, {user: users.data[userId]})
    } catch (error) {
        console.log("Redis:Error:increaseUserCount", error)
        throw new RedisError("Redis:Error:increaseUserCount")
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
    
        return new RedisResponse(true, {user: users.data[userId]})
    } catch (error) {
        console.log("Redis:Error:decreaseUserCount", error)
        throw new RedisError("Redis:Error:decreaseUserCount")
    }
  }
}

export const redisAdapter = new RedisAdapter(redis);
