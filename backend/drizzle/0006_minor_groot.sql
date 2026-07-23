CREATE TABLE "anchor_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"anchor_id" uuid NOT NULL,
	"label" text NOT NULL,
	"target_role" text,
	"target_industry" text,
	"job_description_text" text,
	"company" text,
	"revised_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "anchor_revisions" ADD CONSTRAINT "anchor_revisions_anchor_id_anchors_id_fk" FOREIGN KEY ("anchor_id") REFERENCES "public"."anchors"("id") ON DELETE no action ON UPDATE no action;