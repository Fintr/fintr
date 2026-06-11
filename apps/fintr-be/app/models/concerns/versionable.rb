# frozen_string_literal: true

module Versionable
  extend ActiveSupport::Concern

  included do
    version_class_name = "#{name}Version"

    has_paper_trail(
      versions: {
        class_name: version_class_name,
        name: :versions
      },
      meta: {
        space_id: :space_id,
        cause: :paper_trail_cause,
        operation: :paper_trail_operation
      },
      skip: %i[updated_at]
    )
  end

  def paper_trail_cause
    PaperTrail.request.controller_info&.dig(:cause)
  end

  def paper_trail_operation
    PaperTrail.request.controller_info&.dig(:operation)
  end
end
