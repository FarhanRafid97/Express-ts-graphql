import argon2 from 'argon2';
import { MyContext } from 'src/types';
import {
  Arg,
  Ctx,
  Field,
  InputType,
  Mutation,
  ObjectType,
  Resolver,
} from 'type-graphql';
import { User } from '../entities/User';

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
  @Mutation(() => User)
  async createUser(
    @Arg('option') option: UsernamePasswordInput,
    @Arg('createdAt', { nullable: true }) createdAt: Date,
    @Arg('updatedAt', { nullable: true }) updatedAt: Date,
    @Ctx() { em }: MyContext
  ) {
    const hashPassword = await argon2.hash(option.password);
    const user = em.fork().create(User, {
      username: option.username,
      password: hashPassword,
      createdAt,
      updatedAt,
    });
    await em.fork().persistAndFlush(user);
    return user;
  }
  @Mutation(() => UserResponse)
  async loginUser(
    @Arg('option') option: UsernamePasswordInput,

    @Ctx() { em }: MyContext
  ): Promise<UserResponse> {
    const user = await em.fork().findOne(User, { username: option.username });
    if (!user) {
      return {
        error: [
          {
            field: 'username',
            message: 'username or password incorect',
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
          },
        ],
      };
    }
    return {
      user,
    };
  }
}
