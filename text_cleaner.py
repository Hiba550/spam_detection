from sklearn.base import BaseEstimator, TransformerMixin
import re
import nltk


class TextCleaner(BaseEstimator, TransformerMixin):
    def __init__(self):
        try:
            self.stop_words = set(nltk.corpus.stopwords.words('english'))
        except LookupError:
            nltk.download('stopwords')
            self.stop_words = set(nltk.corpus.stopwords.words('english'))

    def clean_text(self, text):
        text = text.lower()
        text = re.sub(r'\W+', ' ', text)
        return ' '.join([word for word in text.split() if word not in self.stop_words])

    def fit(self, X, y=None):
        return self

    def transform(self, X, y=None):
        # Ensure X is an iterable of strings (e.g. list, Series, array)
        return [self.clean_text(str(text)) for text in X]
