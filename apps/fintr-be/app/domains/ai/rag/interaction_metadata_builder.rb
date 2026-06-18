# frozen_string_literal: true

module Ai
  module Rag
    class InteractionMetadataBuilder
      def self.for_agentic(result)
        {
          agentic: true,
          model: result[:model],
          provider: result[:provider],
          searched: result[:searched],
          steps: result[:steps],
          tool_calls: result[:tool_calls],
          reasoning_notes: result[:reasoning_notes],
          cited_embedding_ids: result[:cited_embedding_ids],
        }.compact
      end

      def self.audit_prompt_for_agentic(result)
        Rag::Agent::AuditFormatter.format_tool_calls(result[:tool_calls])
      end
    end
  end
end
