CREATE TABLE "concept_edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic_id" uuid NOT NULL,
	"from_concept_id" uuid NOT NULL,
	"to_concept_id" uuid NOT NULL,
	CONSTRAINT "concept_edges_unique" UNIQUE("topic_id","from_concept_id","to_concept_id")
);
--> statement-breakpoint
CREATE TABLE "concepts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"summary" text NOT NULL,
	"difficulty" integer DEFAULT 1 NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"mastery" real DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "concepts_topic_slug_unique" UNIQUE("topic_id","slug")
);
--> statement-breakpoint
ALTER TABLE "topics" ADD COLUMN "status" text DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE "concept_edges" ADD CONSTRAINT "concept_edges_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_edges" ADD CONSTRAINT "concept_edges_from_concept_id_concepts_id_fk" FOREIGN KEY ("from_concept_id") REFERENCES "public"."concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_edges" ADD CONSTRAINT "concept_edges_to_concept_id_concepts_id_fk" FOREIGN KEY ("to_concept_id") REFERENCES "public"."concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concepts" ADD CONSTRAINT "concepts_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;