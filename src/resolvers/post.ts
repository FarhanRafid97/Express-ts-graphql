import { Post } from '../entities/Post';
import { MyContext } from 'src/types';
import { Arg, Ctx, Int, Mutation, Query, Resolver } from 'type-graphql';

Resolver();
export class PostResolver {
  @Query(() => [Post])
  posts(@Ctx() { em }: MyContext): Promise<Post[]> {
    return em.fork().find(Post, {});
  }
  @Query(() => Post, { nullable: true })
  post(
    @Arg('id', () => Int) id: number,
    @Ctx() { em }: MyContext
  ): Promise<Post | null> {
    return em.fork().findOne(Post, { id });
  }
  @Mutation(() => Post)
  async createPost(
    @Arg('name') name: string,
    @Arg('email') email: string,
    @Arg('age') age: number,
    @Arg('createdAt', { nullable: true }) createdAt: Date,
    @Arg('updatedAt', { nullable: true }) updatedAt: Date,
    @Ctx() { em }: MyContext
  ): Promise<Post> {
    const post = em
      .fork()
      .create(Post, { name, email, age, createdAt, updatedAt });
    await em.fork().persistAndFlush(post);
    return post;
  }
  @Mutation(() => Post, { nullable: true })
  async updatePost(
    @Arg('id', { nullable: true }) id: number,
    @Arg('name', { nullable: true }) name: string,
    @Arg('email', { nullable: true }) email: string,
    @Arg('age', { nullable: true }) age: number,
    @Arg('createdAt', { nullable: true }) createdAt: Date,
    @Arg('updatedAt', { nullable: true }) updatedAt: Date,
    @Ctx() { em }: MyContext
  ): Promise<Post | null> {
    const post = await em.fork().findOne(Post, { id });
    if (!post) return null;

    // const post = em
    //   .fork()
    //   .create(Post, { name, email, age, createdAt, updatedAt });
    if (typeof name !== null) {
      post.name = name;
      await em.fork().persistAndFlush(post);
    } else if (typeof email !== null) {
      post.email = email;
      await em.fork().persistAndFlush(post);
    } else if (typeof age !== null) {
      post.age = age;
      await em.fork().persistAndFlush(post);
    }

    return post;
  }

  @Mutation(() => String)
  async deletePost(
    @Arg('id') id: number,
    @Ctx() { em }: MyContext
  ): Promise<string> {
    const data = await em.fork().findOne(Post, { id });
    if (!data) return 'data tidak ada';
    await em.nativeDelete(Post, { id });

    return 'data berhasil di hapus';
  }
}
