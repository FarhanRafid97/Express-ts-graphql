import { Entity, PrimaryKey, Property } from '@mikro-orm/core';
import { Field, ObjectType } from 'type-graphql';

@ObjectType()
@Entity()
export class Post {
  @Field()
  @PrimaryKey()
  id!: Number;

  @Field()
  @Property()
  createdAt: Date = new Date();

  @Field()
  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  @Field()
  @Property()
  name!: string;

  @Field()
  @Property()
  email!: string;

  @Field()
  @Property({ nullable: true })
  age?: number;
}
