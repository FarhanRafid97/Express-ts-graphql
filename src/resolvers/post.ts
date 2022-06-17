import { Post } from '../entities/Post';

import { Arg, Mutation, Query, Resolver } from 'type-graphql';

Resolver();
export class PostResolver {
  @Query(() => [Post])
  posts(): Promise<Post[]> {
    return Post.find();
  }
  @Query(() => Post, { nullable: true })
  post(@Arg('id') id: number): Promise<Post | null> {
    return Post.findOne({ where: { id: id } });
  }
  @Mutation(() => Post)
  async createPost(
    @Arg('name') name: string,
    @Arg('email') email: string,
    @Arg('age') age: number
  ): Promise<Post> {
    return await Post.create({ name, email, age }).save();
  }
  @Mutation(() => Post, { nullable: true })
  async updatePost(
    @Arg('id', { nullable: true }) id: number,
    @Arg('name', { nullable: true }) name: string,
    @Arg('email', { nullable: true }) email: string,
    @Arg('age', { nullable: true }) age: number
  ): Promise<Post | null> {
    const post = await Post.findOne({ where: { id: id } });
    if (!post) return null;

    if (typeof name !== null) {
      post.name = name;
    } else if (typeof email !== null) {
      post.email = email;
    } else if (typeof age !== null) {
      post.age = age;
    }
    await Post.update({ id }, post);

    return post;
  }

  @Mutation(() => String)
  async deletePost(@Arg('id') id: number): Promise<string> {
    const data = await Post.findOne({ where: { id } });
    if (!data) return 'data tidak ada';
    await Post.delete(id);

    return 'data berhasil di hapus';
  }
}
