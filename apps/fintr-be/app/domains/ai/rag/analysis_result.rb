# frozen_string_literal: true

module Ai
  module Rag
    AnalysisResult = Struct.new(
      :query_type,
      :data_sources,
      :aggregations,
      :filters,
      :time_range,
      :sorting,
      :limit,
      :chart_suggestion,
      :space_id,
      keyword_init: true
    )
  end
end
