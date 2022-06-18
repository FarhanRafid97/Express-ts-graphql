import { Post } from '../entities/Post';

import {
  Arg,
  Ctx,
  Field,
  InputType,
  Int,
  Mutation,
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

Resolver();
export class PostResolver {
  // @FieldResolver(() => String)
  // textSnippet(@Root() post: Post) {
  //   return post.text.slice(0, 50);
  // }
  //=== All post
  @Query(() => [Post])
  // @UseMiddleware(isAuth)
  async posts(
    @Arg('limit', () => Int) limit: number,
    @Arg('cursor', () => String, { nullable: true }) cursor: string | null
  ): Promise<Post[]> {
    const realLimit = Math.min(50, limit);
    const queryBuilder = getConnection()
      .getRepository(Post)
      .createQueryBuilder('p')
      .orderBy('"createdAt"', 'DESC')
      .take(realLimit);

    if (cursor) {
      queryBuilder.where('"createdAt" < :cursor', {
        cursor: new Date(cursor),
      });
    }

    return queryBuilder.getMany();
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
