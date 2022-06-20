import { MyContext } from 'src/types';
import {
  Arg,
  Ctx,
  Field,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  UseMiddleware,
} from 'type-graphql';
import { getConnection } from 'typeorm';
import { Post } from '../entities/Post';
import { Updoot } from '../entities/Updoot';
import { isAuth } from '../middleware/isAuth';

@InputType()
class FieldInput {
  @Field()
  title: string;
  @Field()
  text: string;
}

@ObjectType()
class PaginatedPosts {
  @Field(() => [Post])
  posts: Post[];
  @Field(() => Boolean)
  isMorePost: boolean;
}

Resolver();
export class PostResolver {
  // @FieldResolver(() => String)
  // textSnippet(@Root() post: Post) {
  //   return post.text.slice(0, 50);
  // }
  //=== All post

  //====update points
  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async vote(
    @Arg('postId', () => Int) postId: number,
    @Arg('value', () => Int) value: number,
    @Ctx() { req }: MyContext
  ) {
    const isUpdoot = value !== -1;
    const realValue = isUpdoot ? 1 : -1;
    const { userId } = req.session;

    const updoot = await Updoot.findOne({ where: { postId, userId } });

    // the user has voted on the post before
    // and they are changing their vote
    if (updoot && updoot.value !== realValue) {
      await getConnection().transaction(async (tm) => {
        await tm.query(
          `
    update updoot
    set value = $1
    where "postId" = $2 and "userId" = $3
        `,
          [realValue, postId, userId]
        );

        await tm.query(
          `
          update post
          set points = points + $1
          where id = $2
        `,
          [2 * realValue, postId]
        );
      });
    } else if (!updoot) {
      // has never voted before
      await getConnection().transaction(async (tm) => {
        await tm.query(
          `
    insert into updoot ("userId", "postId", value)
    values ($1, $2, $3)
        `,
          [userId, postId, realValue]
        );

        await tm.query(
          `
    update post
    set points = points + $1
    where id = $2
      `,
          [realValue, postId]
        );
      });
    }
    return true;
  }

  @Query(() => PaginatedPosts)
  // @UseMiddleware(isAuth)
  async posts(
    @Arg('limit', () => Int) limit: number,
    @Arg('cursor', () => String, { nullable: true }) cursor: string | null,
    @Ctx() { req }: MyContext
  ): Promise<PaginatedPosts> {
    const realLimit = Math.min(50, limit);
    const realLimitPlustOne = realLimit + 1;

    const replacements: any[] = [realLimitPlustOne];

    if (req.session.userId) {
      replacements.push(req.session.userId);
    }

    let cursorIdx = 3;
    if (cursor) {
      replacements.push(new Date(cursor));
      cursorIdx = replacements.length;
    }

    console.log(cursorIdx);
    const posts = await getConnection().query(
      `
    select p.*,
    json_build_object(
      'id', u.id,
      'username', u.username,
      'email', u.email,
      'createdAt', u."createdAt",
      'updatedAt', u."updatedAt"
      ) creator,
    ${
      req.session.userId
        ? `(select value from updoot where "userId" = $2 and "postId" = p.id) "voteStatus"`
        : 'null as "voteStatus"'
    }
    from post p
    inner join public.user u on u.id = p."creatorId"
    ${cursor ? `where p."createdAt" < $${cursorIdx}` : ''}
    order by p."createdAt" DESC
    limit $1
    `,
      replacements
    );

    // );
    // const queryBuilder = getConnection()
    //   .getRepository(Post)
    //   .createQueryBuilder('p')
    //   .orderBy('"createdAt"', 'DESC')
    //   .take(realLimitPlustOne);

    // if (cursor) {
    //   queryBuilder.where('"createdAt" < :cursor', {
    //     cursor: new Date(cursor),
    //   });
    // }
    // const posts = await queryBuilder.getMany();

    return {
      posts: posts.slice(0, realLimit),
      isMorePost: posts.length === realLimitPlustOne,
    };
  }

  //====detail post
  @Query(() => Post, { nullable: true })
  post(@Arg('id', () => Int) id: number): Promise<Post | null> {
    return Post.findOne({ where: { id: id }, relations: ['creator'] });
  }

  //==create post

  @Mutation(() => Post)
  @UseMiddleware(isAuth)
  async createPost(
    @Arg('input') input: FieldInput,
    @Ctx() { req }: MyContext
  ): Promise<Post> {
    return await Post.create({
      ...input,
      creatorId: req.session.userId,
    }).save();
  }

  //=======

  //====UPdate Post`

  @Mutation(() => Post, { nullable: true })
  async updatePost(
    @Arg('id', () => Int) id: number,
    @Arg('title') title: string,
    @Arg('text') text: string,
    @Ctx() { req }: MyContext
  ): Promise<Post | null> {
    const result = await getConnection()
      .createQueryBuilder()
      .update(Post)
      .set({ title, text })
      .where('id = :id and "creatorId" = :creatorId', {
        id,
        creatorId: req.session.userId,
      })
      .returning('*')
      .execute();
    console.log(result.raw[0]);
    return result.raw[0];
  }

  //====Delete post
  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async deletePost(
    @Arg('id', () => Int) id: number,
    @Ctx() { req }: MyContext
  ): Promise<boolean> {
    const post = await Post.findOne({ where: { id: id } });
    if (!post) {
      return false;
    }
    if (post.creatorId !== req.session.userId) {
      throw new Error('not Authorization');
    }
    // await Updoot.delete({ postId: id });
    await Post.delete({ id, creatorId: req.session.userId });

    return true;
  }
}
