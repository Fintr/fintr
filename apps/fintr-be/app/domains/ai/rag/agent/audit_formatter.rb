# frozen_string_literal: true

module Ai
  module Rag
    module Agent
      class AuditFormatter
        def self.format_tool_calls(tool_call_trail)
          Array(tool_call_trail).map.with_index(1) do |entry, index|
            arguments = entry[:arguments] || entry["arguments"] || {}
            result = entry[:result] || entry["result"]
            truncated = entry[:result_truncated] || entry["result_truncated"]
            name = entry[:name] || entry["name"]

            lines = [
              "### Tool call #{index}: #{name}",
              "Arguments: #{arguments.to_json}",
              "Result#{truncated ? ' (truncated)' : ''}:",
              result.to_s
            ]

            lines.join("\n")
          end.join("\n\n")
        end
      end
    end
  end
end
