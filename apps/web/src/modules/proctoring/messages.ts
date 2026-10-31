import { defineMessages } from '@/shared/i18n'

export const proctoringMessages = defineMessages({
  ru: {
    proctoring: {
      hint: {
        face_missing: 'Мы не видим ваше лицо. Сядьте перед камерой.',
        multiple_faces: 'В кадре несколько человек. Во время экзамена вы должны быть один.',
        too_dark: 'Слишком темно. Включите свет или повернитесь к окну.',
        noise: 'Вокруг шумно. Постарайтесь найти тихое место.',
        tab_hidden: 'Пожалуйста, оставайтесь на вкладке экзамена.',
        camera_off: 'Камера выключена. Включите её, чтобы продолжить под наблюдением.',
        looking_away: 'Пожалуйста, смотрите на экран.',
        object_detected: 'Уберите телефон и книги из поля зрения камеры.',
      },
      camera: {
        on: 'Камера включена',
        off: 'Камера выключена',
        starting: 'Включаем камеру…',
        allow: 'Разрешите доступ к камере в браузере',
        enable: 'Включить камеру',
        recordedFull: 'Экзамен записывается полностью',
        recordedLocally: 'Запись хранится на устройстве',
      },
      check: {
        camera: 'Камера',
        face: 'Вас видно',
        light: 'Освещение',
        blocked: 'Камера не видна — нужно разрешение браузера',
        again: 'Проверить снова',
        hint: {
          camera: 'Разрешите доступ к камере и микрофону в браузере.',
          faceMany: 'В кадре должны быть только вы.',
          faceNone: 'Сядьте так, чтобы лицо было в кадре.',
          light: 'Слишком темно: включите свет или повернитесь к окну.',
        },
      },
    },
  },
  kk: {
    proctoring: {
      hint: {
        face_missing: 'Біз сіздің бетіңізді көрмей тұрмыз. Камераның алдына отырыңыз.',
        multiple_faces: 'Кадрда бірнеше адам бар. Емтихан кезінде сіз жалғыз болуыңыз керек.',
        too_dark: 'Тым қараңғы. Жарықты қосыңыз немесе терезеге қарай бұрылыңыз.',
        noise: 'Айналада шулы. Тыныш орын табуға тырысыңыз.',
        tab_hidden: 'Емтихан қойындысында қалыңыз.',
        camera_off: 'Камера өшірулі. Бақылаумен жалғастыру үшін оны қосыңыз.',
        looking_away: 'Экранға қараңыз.',
        object_detected: 'Телефон мен кітаптарды камераның көру аймағынан алып тастаңыз.',
      },
      camera: {
        on: 'Камера қосулы',
        off: 'Камера өшірулі',
        starting: 'Камераны қосып жатырмыз…',
        allow: 'Браузерде камераға рұқсат беріңіз',
        enable: 'Камераны қосу',
        recordedFull: 'Емтихан толығымен жазылады',
        recordedLocally: 'Жазба құрылғыда сақталады',
      },
      check: {
        camera: 'Камера',
        face: 'Сіз көрінесіз',
        light: 'Жарық',
        blocked: 'Камера көрінбейді — браузердің рұқсаты қажет',
        again: 'Қайта тексеру',
        hint: {
          camera: 'Браузерде камера мен микрофонға рұқсат беріңіз.',
          faceMany: 'Кадрда тек сіз болуыңыз керек.',
          faceNone: 'Бетіңіз кадрда болатындай отырыңыз.',
          light: 'Тым қараңғы: жарықты қосыңыз немесе терезеге қарай бұрылыңыз.',
        },
      },
    },
  },
  en: {
    proctoring: {
      hint: {
        face_missing: 'We cannot see your face. Sit in front of the camera.',
        multiple_faces: 'There is more than one person in view. You must be alone during the exam.',
        too_dark: 'It is too dark. Turn on a light or face a window.',
        noise: 'It is noisy around you. Try to find a quiet place.',
        tab_hidden: 'Please stay on the exam tab.',
        camera_off: 'The camera is off. Turn it on to continue under supervision.',
        looking_away: 'Please look at the screen.',
        object_detected: 'Move phones and books out of the camera’s view.',
      },
      camera: {
        on: 'Camera on',
        off: 'Camera off',
        starting: 'Turning on the camera…',
        allow: 'Allow camera access in your browser',
        enable: 'Turn on the camera',
        recordedFull: 'The whole exam is recorded',
        recordedLocally: 'The recording stays on your device',
      },
      check: {
        camera: 'Camera',
        face: 'You are visible',
        light: 'Lighting',
        blocked: 'No camera — the browser needs your permission',
        again: 'Check again',
        hint: {
          camera: 'Allow camera and microphone access in your browser.',
          faceMany: 'Only you should be in view.',
          faceNone: 'Sit so that your face is in view.',
          light: 'Too dark: turn on a light or face a window.',
        },
      },
    },
  },
})
