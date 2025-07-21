export default {
  app: {
    title: 'Загрузчик Рукописей',
    description: 'Загрузка рукописей из 7 рабочих цифровых библиотек + 1 в разработке',
    footer: 'Настольное приложение для загрузки рукописей'
  },
  downloader: {
    title: 'Загрузить Рукопись',
    urlLabel: 'URL рукописи',
    urlPlaceholder: 'Введите URL рукописи из любой поддерживаемой библиотеки...',
    downloadButton: 'Скачать PDF',
    parsing: 'Обработка рукописи...',
    downloading: 'Загрузка изображений...',
    processing: 'Создание PDF...',
    completed: 'Загрузка завершена!',
    error: 'Произошла ошибка',
    cancel: 'Отмена',
    progress: {
      pages: 'Страницы: {current}/{total}',
      percentage: '{percentage}% завершено',
      timeRemaining: 'Осталось времени: {time}',
      downloadSpeed: 'Скорость: {speed}/с'
    },
    supportedLibraries: 'Поддерживаемые Библиотеки',
    examples: 'Примеры',
    clearCache: 'Очистить Кэш',
    cacheStats: 'Статистика Кэша',
    cacheCleared: 'Кэш успешно очищен',
    workingLibraries: '7 рабочих + 1 в разработке',
    searchLibraries: 'Поиск библиотек...',
    noLibrariesFound: 'Библиотеки по вашему запросу не найдены'
  },
  libraries: {
    gallica: {
      name: 'Gallica (BnF)',
      description: 'Цифровые рукописи Французской национальной библиотеки (поддерживает любой формат f{page}.*)'
    },
    unifr: {
      name: 'e-codices (Unifr)',
      description: 'Швейцарская виртуальная библиотека рукописей'
    },
    vatican: {
      name: 'Ватиканская Библиотека',
      description: 'Цифровые коллекции Ватиканской апостольской библиотеки'
    },
    cecilia: {
      name: 'Cecilia (Grand Albigeois)',
      description: 'Цифровые коллекции медиатек Гранд Альбижуа'
    },
    irht: {
      name: 'IRHT (CNRS)',
      description: 'Цифровые рукописи Института исследований и истории текстов'
    },
    dijon: {
      name: 'Dijon Patrimoine',
      description: 'Цифровые рукописи Муниципальной библиотеки Дижона'
    },
    laon: {
      name: 'Laon Bibliothèque ⚠️',
      description: 'Цифровые рукописи Муниципальной библиотеки Лаона (ПОКА НЕ РАБОТАЕТ - проблемы с прокси)'
    },
    durham: {
      name: 'Durham University',
      description: 'Цифровые рукописи Библиотеки Дархемского университета через IIIF'
    }
  },
  settings: {
    title: 'Настройки',
    download: {
      title: 'Настройки Загрузки',
      maxConcurrent: 'Макс. одновременных загрузок',
      maxRetries: 'Макс. попыток',
      requestTimeout: 'Таймаут запроса'
    },
    pdf: {
      title: 'Настройки PDF',
      quality: 'Качество PDF',
      autoSplitThreshold: 'Порог автоматического разделения'
    },
    ui: {
      title: 'Интерфейс',
      language: 'Язык',
      theme: 'Тема',
      themeSystem: 'Системная',
      themeLight: 'Светлая',
      themeDark: 'Тёмная'
    },
    resetToDefaults: 'Сбросить к по умолчанию',
    confirmReset: 'Вы уверены, что хотите сбросить все настройки к значениям по умолчанию?'
  },
  common: {
    close: 'Закрыть',
    save: 'Сохранить',
    cancel: 'Отмена',
    ok: 'ОК'
  }
}