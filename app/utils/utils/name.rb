# frozen_string_literal: true

module Utils
  class Name
    class << self
      def possessive(name)
        return "" if name.blank? # Handle blank input

        if name.downcase.end_with?("s")
          "#{name}'"
        else
          "#{name}'s"
        end
      end
    end
  end
end
