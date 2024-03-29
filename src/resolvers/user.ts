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
  UseMiddleware,
} from 'type-graphql';
import { v4 } from 'uuid';
import { COOKIE_NAME, FORGET_PASSWORD_PREFIX, THREE_DAYS } from '../constants';
import { Post } from '../entities/Post';
import { Profile } from '../entities/Profile';
import { User } from '../entities/User';
import { isAuth } from '../middleware/isAuth';
import { sendEmail } from '../utils/sendEmail';
import { validateRegister } from '../utils/validateRegister';
import { UsernamePasswordInput } from './UsernamePasswordInput';

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
@ObjectType()
class EmailResponse {
  @Field(() => [FieldError], { nullable: true })
  error?: FieldError[];
  @Field(() => String, { nullable: true })
  linkEmail?: String | Boolean;
}

@InputType()
class InputProfile {
  @Field()
  address: string;
  @Field()
  phoneNumber: string;
  @Field()
  gender: string;
}

Resolver();
export class UserResolver {
  @Query(() => [User], { nullable: true })
  async selectAllUser(): Promise<User[]> {
    const dataUser = await Post.find();
    console.log(dataUser);
    const userFind = await User.find({ relations: { profile: true } });
    console.log(dataUser);
    return userFind;
  }
  @Mutation(() => Profile)
  @UseMiddleware(isAuth)
  async updateProfile(
    @Arg('input') input: InputProfile,
    @Ctx() { req }: MyContext
  ): Promise<Profile | null> {
    const user = await User.findOne({
      where: { id: req.session.userId },
      select: ['profileId'],
    });

    await Profile.update({ id: user?.profileId }, { ...input });
    const updatedUser = await User.findOne({
      where: { id: req.session.userId },
      relations: { profile: true },
    });
    console.log(updatedUser);
    return await Profile.findOne({ where: { id: user?.profileId } });
  }

  @Mutation(() => UserResponse)
  async changePassword(
    @Arg('token') token: string,
    @Arg('newPassword') newPassword: string,
    @Ctx() { redis, req }: MyContext
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
    const key = FORGET_PASSWORD_PREFIX + token;
    const userId = await redis.get(key);

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
    const userIdNum = parseInt(userId);
    const user = await User.findOne({ where: { id: userIdNum } });
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

    await User.update(
      { id: userIdNum },
      { password: await argon2.hash(newPassword) }
    );
    redis.del(key);
    req.session.userId = user.id;
    return { user };
  }
  @Mutation(() => EmailResponse)
  async forgetPassword(
    @Arg('email') email: string,
    @Ctx() { redis }: MyContext
  ): Promise<Boolean | EmailResponse> {
    const user = await User.findOne({ where: { email: email } });
    if (!user) {
      return {
        error: [
          {
            field: 'email',
            message: 'email not found',
            status: 400,
          },
        ],
      };
    }

    const token = v4();
    redis.set(
      FORGET_PASSWORD_PREFIX + token,
      user.id as number,
      'EX',
      THREE_DAYS
    );
    const emailSend = await sendEmail(
      email,
      `<a href="http://localhost:3000/change-password/${token}">reset password</a>`
    );
    return { linkEmail: emailSend };
  }

  @Query(() => User, { nullable: true })
  async myBio(@Ctx() { req }: MyContext) {
    console.log(req.session);
    if (!req.session.userId) return null;

    const dataUser = await User.findOne({
      where: { id: req.session.userId },
      relations: {
        profile: true,
      },
    });
    console.log(dataUser);
    // if (!dataUser?.profile) {
    //   const dataProfile = await Profile.create({
    //     address: '',
    //     gender: '',
    //     phoneNumber: '',
    //   }).save();
    //   await User.update(
    //     { id: req.session.userId },
    //     { profileId: dataProfile.id }
    //   );
    // }

    return dataUser;
  }

  @Mutation(() => UserResponse)
  async createUser(
    @Arg('option') option: UsernamePasswordInput,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    const error = validateRegister(option);
    if (error) {
      return { error };
    }
    const hashPassword = await argon2.hash(option.password);
    let user;
    try {
      const result = await User.create({
        username: option.username,
        email: option.email,
        password: hashPassword,
      }).save();
      console.log(result);
      req.session.userId = result.id;
      const dataProfile = await Profile.create({
        address: '',
        gender: '',
        phoneNumber: '',
      }).save();
      await User.update({ id: result.id }, { profileId: dataProfile.id });
      user = result;
    } catch (err) {
      if (err.constraint === 'UQ_78a916df40e02a9deb1c4b75edb') {
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
      if (err.constraint === 'UQ_e12875dfb3b1d92d7d7c5377e22') {
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

    return { user };
  }
  @Mutation(() => UserResponse)
  async loginUser(
    @Arg('usernameOrEmail') usernameOrEmail: string,
    @Arg('password') password: string,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    const user = await User.findOne(
      usernameOrEmail.includes('@')
        ? { where: { email: usernameOrEmail } }
        : { where: { username: usernameOrEmail } }
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
    // if (!user.profileId) {
    //   const dataProfile = await Profile.create({
    //     address: '',
    //     gender: '',
    //     phoneNumber: '',
    //   }).save();
    //   await User.update({ id: user.id }, { profileId: dataProfile.id });
    // }
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
