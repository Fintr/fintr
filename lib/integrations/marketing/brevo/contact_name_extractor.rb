# frozen_string_literal: true

module Integrations
  module Marketing
    module Brevo
      class ContactNameExtractor
        def self.call(value:)
          normalized_value = value.to_s.strip
          return blank_result if normalized_value.blank?
          return blank_result if normalized_value.include?("@")
          if normalized_value.include?("(") && normalized_value.include?(")")
            return extract_parenthetical_name(normalized_value:)
          end

          if normalized_value.include?(",")
            return extract_comma_separated_name(normalized_value:)
          end

          extract_space_separated_name(normalized_value:)
        end

        def self.blank_result
          {
            first_name: nil,
            last_name: nil
          }
        end

        def self.extract_comma_separated_name(normalized_value:)
          raw_last_name, raw_first_name = normalized_value.split(",", 2)
          last_name = normalized_part(part: raw_last_name)
          first_name = normalized_part(part: raw_first_name)

          {
            first_name: presence_or_nil(value: first_name),
            last_name: presence_or_nil(value: last_name)
          }
        end

        def self.extract_space_separated_name(normalized_value:)
          parts = normalized_value.split(/\s+/)
          return blank_result if parts.empty?

          if parts.length == 1
            return {
              first_name: parts.first,
              last_name: nil
            }
          end

          {
            first_name: parts[0...-1].join(" "),
            last_name: parts.last
          }
        end

        def self.extract_parenthetical_name(normalized_value:)
          cleaned_value = normalized_value.gsub(/\s*\(.*?\)\s*/, " ").strip
          extract_space_separated_name(normalized_value: cleaned_value)
        end

        def self.normalized_part(part:)
          part.to_s.strip.gsub(/\s+/, " ")
        end

        def self.presence_or_nil(value:)
          value.presence
        end
      end
    end
  end
end
