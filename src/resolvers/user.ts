import argon2 from 'argon2';
import { MyContext } from 'src/types';
import {
  Arg,
  Ctx,
  Field,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from 'type-graphql';
import { User } from '../entities/User';
import { EntityManager } from '@mikro-orm/postgresql';
import { COOKIE_NAME, FORGET_PASSWORD_PREFIX, THREE_DAYS } from '../constants';
import { UsernamePasswordInput } from './UsernamePasswordInput';
import { validateRegister } from '../utils/validateRegister';
import { v4 } from 'uuid';
import { sendEmail } from '../utils/sendEmail';
// declare module 'express-session' {
//   export interface SessionData {
//     userId: { [key: string]: any };
//   }
// }

declare module 'express-session' {
  interface SessionData {
    userId?: number | any;
  }
}
@ObjectType()
class FieldError {
  @Field()
  field: string;
  @Field()
  message: string;
  @Field()
  status: number;
}

@ObjectType()
class UserResponse {
  @Field(() => [FieldError], { nullable: true })
  error?: FieldError[];
  @Field(() => User, { nullable: true })
  user?: User;
}

Resolver();
export class UserResolver {
  @Mutation(() => UserResponse)
  async changePassword(
    @Arg('token') token: string,
    @Arg('newPassword') newPassword: string,
    @Ctx() { em, redis }: MyContext
  ): Promise<UserResponse> {
    if (newPassword.length <= 2) {
      return {
        error: [
          {
            field: 'newPassword',
            message: 'length must be greater than 2',
            status: 400,
          },
        ],
      };
    }
    const userId = await redis.get(FORGET_PASSWORD_PREFIX + token);
    if (!userId) {
      return {
        error: [
          {
            field: 'token',
            message: 'Wrong Token Or expired Token',
            status: 400,
          },
        ],
      };
    }
    const user = await em.fork().findOne(User, { id: parseInt(userId) });
    if (!user) {
      return {
        error: [
          {
            field: 'token',
            message: 'expired Token',
            status: 400,
          },
        ],
      };
    }
    user.password = await argon2.hash(newPassword);
    await em.fork().persistAndFlush(user);

    return { user };
  }
  @Mutation(() => Boolean)
  async forgetPassword(
    @Arg('email') email: string,
    @Ctx() { em, redis }: MyContext
  ): Promise<Boolean> {
    const user = await em.fork().findOne(User, { email });
    if (!user) {
      return true;
    }

    const token = v4();
    redis.set(
      FORGET_PASSWORD_PREFIX + token,
      user.id as number,
      'EX',
      THREE_DAYS
    );
    await sendEmail(
      email,
      `<a href="http://localhost:3000/change-password/${token}">reset password</a>`
    );
    return true;
  }

  @Query(() => User, { nullable: true })
  myBio(@Ctx() { req, em }: MyContext) {
    console.log(req.session);
    if (!req.session.userId) return null;
    const myUser = em.fork().findOne(User, { id: req.session.userId });

    return myUser;
  }
  @Mutation(() => UserResponse)
  async createUser(
    @Arg('option') option: UsernamePasswordInput,
    @Ctx() { req, em }: MyContext
  ): Promise<UserResponse> {
    const error = validateRegister(option);
    if (error) {
      return { error };
    }
    const hashPassword = await argon2.hash(option.password);
    let user;
    try {
      const result = await (em.fork() as EntityManager)
        .createQueryBuilder(User)
        .getKnexQuery()
        .insert({
          username: option.username,
          password: hashPassword,
          email: option.email,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('*');
      user = result[0];
    } catch (err) {
      if (err.constraint === 'user_username_unique') {
        return {
          error: [
            {
              field: 'username',
              message: 'username alredy exist',
              status: 400,
            },
          ],
        };
      }
      if (err.constraint === 'user_email_unique') {
        return {
          error: [
            {
              field: 'email',
              message: 'email alredy exist',
              status: 400,
            },
          ],
        };
      }
    }

    req.session.userId = user.id;
    return { user };
  }
  @Mutation(() => UserResponse)
  async loginUser(
    @Arg('usernameOrEmail') usernameOrEmail: string,
    @Arg('password') password: string,
    @Ctx() { em, req }: MyContext
  ): Promise<UserResponse> {
    const user = await em
      .fork()
      .findOne(
        User,
        usernameOrEmail.includes('@')
          ? { email: usernameOrEmail }
          : { username: usernameOrEmail }
      );
    if (!user) {
      return {
        error: [
          {
            field: 'usernameOrEmail',
            message: 'username or email incorect',
            status: 400,
          },
        ],
      };
    }
    const isValid = await argon2.verify(user.password, password);

    if (!isValid) {
      return {
        error: [
          {
            field: 'password',
            message: 'username or password incorect',
            status: 400,
          },
        ],
      };
    }
    req.session.userId = user.id;
    return {
      user,
    };
  }

  @Mutation(() => Boolean)
  logout(@Ctx() { req, res }: MyContext) {
    return new Promise((resolve) => {
      req.session.destroy((err) => {
        res.clearCookie(COOKIE_NAME);
        if (err) {
          console.log(err);
          resolve(false);
          return;
        }
        return resolve(true);
      });
    });
  }
}
