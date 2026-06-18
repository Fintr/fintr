# frozen_string_literal: true

module Ai
  module Rag
    module Agent
      module Tools
        class Note < RubyLLM::Tool
          include Auditable

          MAX_NOTES = 12

          description <<~DESC
            Write a short reasoning note: why you are searching, how you judge results, or your conclusion.
            NOT the user-facing answer — only for tracing your decision process.
          DESC

          param :thought,
            desc: "One or two sentences of reasoning",
            required: true

          def initialize(collector:)
            @collector = collector
            super()
          end

          def name
            "note"
          end

          def execute(thought:)
            tool_arguments = { thought: thought }

            result = if @collector.reasoning_notes.size >= MAX_NOTES
              "You have noted enough; proceed with a search or with the answer."
            else
              @collector.add_reasoning(thought)
              "Noted."
            end

            audit_and_return(
              arguments: tool_arguments,
              result: result,
            )
          end
        end
      end
    end
  end
end
