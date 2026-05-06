# frozen_string_literal: true

module Ai
  module Serializers
    class ConversationMessageSerializer < Blueprinter::Base
      identifier :id

      fields :content,
             :openai_role,
             :metadata,
             :created_at
    end
  end
end
