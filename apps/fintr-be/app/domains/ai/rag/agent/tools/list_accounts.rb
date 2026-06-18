# frozen_string_literal: true

module Ai
  module Rag
    module Agent
      module Tools
        class ListAccounts < RubyLLM::Tool
          include Auditable

          LIMIT = 20

          description <<~DESC
            List accounts available in the user's space.
            Use to orient yourself before filtering by account name.
          DESC

          def initialize(space_id:, collector:)
            @space_id = space_id
            @collector = collector
            super()
          end

          def name
            "list_accounts"
          end

          def execute
            space = Spaces::Space.find_by(id: @space_id)
            unless space
              return audit_and_return(
                arguments: {},
                result: "Space not accessible.",
              )
            end

            accounts = space.accounts.order(:name).limit(LIMIT)

            result = if accounts.empty?
              "No accounts found."
            else
              accounts.map { |account| "- #{account.name} [account:#{account.id}]" }.join("\n")
            end

            audit_and_return(
              arguments: {},
              result: result,
            )
          rescue StandardError => e
            Rails.logger.warn "[Agent] list_accounts failed: #{e.message}"
            audit_and_return(
              arguments: {},
              result: "Could not list accounts.",
            )
          end
        end
      end
    end
  end
end
