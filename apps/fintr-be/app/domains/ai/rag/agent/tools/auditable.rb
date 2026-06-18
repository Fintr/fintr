# frozen_string_literal: true

module Ai
  module Rag
    module Agent
      module Tools
        module Auditable
          private

          def audit_tool_call(arguments:, result:)
            @collector.record_tool_call(
              name: name,
              arguments: arguments,
              result: result,
            )
          end

          def audit_and_return(arguments:, result:)
            audit_tool_call(
              arguments: arguments,
              result: result,
            )
            result
          end
        end
      end
    end
  end
end
