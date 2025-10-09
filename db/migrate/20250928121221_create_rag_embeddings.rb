# frozen_string_literal: true

class CreateRagEmbeddings < ActiveRecord::Migration[8.0]
  def change
    # Try to enable pgvectorscale extension first, fall back to pgvector if not available
    begin
      execute 'CREATE EXTENSION IF NOT EXISTS vectorscale CASCADE;'
    rescue ActiveRecord::StatementInvalid
      execute 'CREATE EXTENSION IF NOT EXISTS vector CASCADE;'
    end

    create_table :rag_embeddings, id: :uuid do |t|
      t.uuid :space_id, null: false
      t.string :embeddable_type, null: false
      t.uuid :embeddable_id, null: false
      t.text :content, null: false
      t.vector :embedding, limit: 1536, null: false
      t.jsonb :metadata, default: {}
      t.timestamps
    end

    add_index :rag_embeddings, [:embeddable_type, :embeddable_id], unique: true
    add_index :rag_embeddings, :space_id

    # Use pgvectorscale for high-performance vector operations
    # Create HNSW index with pgvectorscale optimizations
    execute <<-SQL
      CREATE INDEX rag_embeddings_embedding_hnsw_idx ON rag_embeddings
      USING hnsw (embedding vector_cosine_ops)
      WITH (m = 32, ef_construction = 128);
    SQL

    add_foreign_key :rag_embeddings, :spaces, column: :space_id
  end
end
