import argon2 from 'argon2';
import { MyContext } from 'src/types';
import {
  Arg,
  Ctx,
  Field,
  InputType,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from 'type-graphql';
import { User } from '../entities/User';

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
@InputType()
class UsernamePasswordInput {
  @Field()
  username: string;
  @Field()
  password: string;
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
    @Arg('createdAt', { nullable: true }) createdAt: Date,
    @Arg('updatedAt', { nullable: true }) updatedAt: Date,
    @Ctx() { req, em }: MyContext
  ): Promise<UserResponse> {
    if (option.username.length <= 2) {
      return {
        error: [
          {
            field: 'username',
            message: 'Username Must be greater than 2',
            status: 400,
          },
        ],
      };
    }
    if (option.password.length <= 3) {
      return {
        error: [
          {
            field: 'password',
            message: 'Password Must be greater than 3',
            status: 400,
          },
        ],
      };
    }

    const hashPassword = await argon2.hash(option.password);
    const user = em.fork().create(User, {
      username: option.username,
      password: hashPassword,
      createdAt,
      updatedAt,
    });
    try {
      await em.fork().persistAndFlush(user);
    } catch (err) {
      if (err.code === '23505') {
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
    }
    req.session.userId = user.id;
    return { user };
  }
  @Mutation(() => UserResponse)
  async loginUser(
    @Arg('option') option: UsernamePasswordInput,

    @Ctx() { em, req }: MyContext
  ): Promise<UserResponse> {
    const user = await em.fork().findOne(User, { username: option.username });
    if (!user) {
      return {
        error: [
          {
            field: 'username',
            message: 'username or password incorect',
            status: 400,
          },
        ],
      };
    }
    const isValid = await argon2.verify(user.password, option.password);

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
}
