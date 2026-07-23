CREATE TABLE "session_mining_results" (
	"session_id" uuid PRIMARY KEY NOT NULL,
	"ownership_language_present" boolean NOT NULL,
	"tradeoff_reasoning_present" boolean NOT NULL,
	"tech_domain_mentions" jsonb NOT NULL,
	"clarity" text NOT NULL,
	"sentiment" text NOT NULL,
	"growth_signals" jsonb NOT NULL,
	"outcome_mentioned" boolean NOT NULL,
	"quantified_impact_examples" jsonb NOT NULL,
	"audience_keyword_matches" jsonb,
	"topic_relevance_score" integer NOT NULL,
	"mined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "session_mining_results" ADD CONSTRAINT "session_mining_results_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;