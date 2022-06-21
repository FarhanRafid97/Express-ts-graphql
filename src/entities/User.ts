import { MyContext } from 'src/types';
import {
  Ctx,
  Field,
  FieldResolver,
  ObjectType,
  Resolver,
  Root,
} from 'type-graphql';
import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Post } from './Post';
import { Profile } from './Profile';
import { Updoot } from './Updoot';

@ObjectType()
@Entity()
export class User extends BaseEntity {
  @Field()
  @PrimaryGeneratedColumn()
  id!: number;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;

  @Field()
  @Column({ unique: true })
  username!: string;

  @Field()
  @OneToOne(() => Profile, (profile) => profile.user)
  @JoinColumn()
  profile: Profile;

  @Field()
  @Column({ nullable: true })
  profileId?: number;

  @OneToMany(() => Updoot, (updoot) => updoot.user)
  updoots: Updoot[];

  @Field()
  @Column({ unique: true })
  email!: string;

  @OneToMany(() => Post, (post) => post.creator)
  posts: Post[];

  @Column()
  password!: string;
}

@Resolver(User)
export class ResolverUser {
  @FieldResolver(() => String)
  email(@Root() user: User, @Ctx() { req }: MyContext) {
    if (req.session.userId === user.id) {
      return user.email;
    }
    return '';
  }
}
