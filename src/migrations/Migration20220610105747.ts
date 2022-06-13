import { Migration } from '@mikro-orm/migrations';

export class Migration20220610105747 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "post" alter column "id" type int using ("id"::int);');
    this.addSql('alter table "post" drop constraint "post_pkey";');
    this.addSql('alter table "post" drop column "_id";');
    this.addSql('create sequence if not exists "post_id_seq";');
    this.addSql('select setval(\'post_id_seq\', (select max("id") from "post"));');
    this.addSql('alter table "post" alter column "id" set default nextval(\'post_id_seq\');');
    this.addSql('alter table "post" add constraint "post_pkey" primary key ("id");');
  }
  async down(): Promise<void> {
    this.addSql('alter table "post" add column "_id" serial;');
    this.addSql('alter table "post" alter column "id" type varchar using ("id"::varchar);');
    this.addSql('alter table "post" drop constraint "post_pkey";');
    this.addSql('alter table "post" alter column "id" drop default;');
    this.addSql('alter table "post" add constraint "post_pkey" primary key ("_id");');
  }

}
