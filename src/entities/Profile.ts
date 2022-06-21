import { Field, ObjectType } from 'type-graphql';
import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './User';

@ObjectType()
@Entity()
export class Profile extends BaseEntity {
  @Field()
  @PrimaryGeneratedColumn()
  id!: number;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;

  //   @OneToOne(() => User)
  //   @JoinColumn()
  //   user: User;

  @OneToOne(() => User, (user) => user.profile) // specify inverse side as a second parameter
  user: User;

  @Field()
  @Column({ nullable: true })
  address!: string;

  @Field()
  @Column({ nullable: true })
  phoneNumber!: string;

  @Field()
  @Column({ nullable: true })
  gender!: string;
}
