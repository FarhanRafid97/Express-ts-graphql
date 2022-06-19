import { Post } from '../entities/Post';

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
  // FieldResolver,
  // Root,
} from 'type-graphql';
import { MyContext } from 'src/types';
import { isAuth } from '../middleware/isAuth';
import { getConnection } from 'typeorm';

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
  @Query(() => PaginatedPosts)
  // @UseMiddleware(isAuth)
  async posts(
    @Arg('limit', () => Int) limit: number,
    @Arg('cursor', () => String, { nullable: true }) cursor: string | null
  ): Promise<PaginatedPosts> {
    const realLimit = Math.min(50, limit);
    const realLimitPlustOne = realLimit + 1;

    const replacements: any[] = [realLimitPlustOne];

    if (cursor) {
      replacements.push(new Date(parseInt(cursor)));
    }

    const posts = await getConnection().query(
      `
    select p.*,
    json_build_object(
      'id', u.id,
      'username', u.username,
      'email', u.email,
      'createdAt', u."createdAt",
      'updatedAt', u."updatedAt"
      ) creator
    from post p
    inner join public.user u on u.id = p."creatorId"
    ${cursor ? `where p."createdAt" < $2` : ''}
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
    console.log('posts: ', posts);

    return {
      posts: posts.slice(0, realLimit),
      isMorePost: posts.length === realLimitPlustOne,
    };
  }

  //====detail post
  @Query(() => Post, { nullable: true })
  @UseMiddleware(isAuth)
  post(@Arg('id') id: number): Promise<Post | null> {
    return Post.findOne({ where: { id: id } });
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

  //====UPdate Post

  @Mutation(() => Post, { nullable: true })
  async updatePost(
    @Arg('id') id: number,
    @Arg('input') input: FieldInput
  ): Promise<Post | null> {
    const post = await Post.findOne({ where: { id: id } });
    if (!post) return null;

    await Post.update({ id }, { ...input });

    return post;
  }

  //====Delete post
  @Mutation(() => String)
  async deletePost(@Arg('id') id: number): Promise<string> {
    const data = await Post.findOne({ where: { id } });
    if (!data) return 'data tidak ada';
    await Post.delete(id);

    return 'data berhasil di hapus';
  }
}
